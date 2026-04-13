import { NextRequest, NextResponse } from "next/server";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function buildImagePrompt(rawPrompt: string): string {
  const cleaned = rawPrompt
    .replace(/^generate\s+an?\s+image\s+of\s+(a\s+|an\s+)?/i, "")
    .replace(/^(create|generate|make|show|depict|illustrate|render|draw)\s+/i, "")
    .replace(/\b(create|generate|make a photo of|depict|illustrate)\b/gi, "")
    .replace(/\s+/g, " ").trim();
  const quality = [
    "photorealistic","hyperrealistic","sharp focus","8k uhd",
    "professional editorial photography","cinematic lighting",
    "award-winning composition","Canon EOS R5","85mm f/1.4 lens",
    "shallow depth of field","vibrant colors","no text","no watermarks",
  ].join(", ");
  return `${cleaned}, ${quality}, v${Date.now() % 999983}`;
}

// ── Gradient fallback (instant, brand-consistent, never fails) ────────────────
function gradientFallback(seed: number): NextResponse {
  const palettes = [
    ["#FF5C00","#6C2BD9"],["#6366F1","#C4B5FD"],["#0D9488","#6EE7B7"],
    ["#F43F5E","#FDA4AF"],["#F59E0B","#FDE68A"],["#16A34A","#86EFAC"],
    ["#0EA5E9","#38BDF8"],["#8B5CF6","#DDD6FE"],
  ];
  const [c1, c2] = palettes[seed % palettes.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${c1}" stop-opacity="0.85"/>
    <stop offset="100%" stop-color="${c2}" stop-opacity="0.95"/>
  </linearGradient></defs>
  <rect width="1080" height="1080" fill="#0a0a0f"/>
  <rect width="1080" height="1080" fill="url(#bg)"/>
</svg>`;
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*",
      "X-Image-Source": "gradient-fallback",
    },
  });
}

// ════════════════════════════════════════════════════════════════════════════
//  PROVIDER 1 — Pollinations (authenticated with POLLINATIONS_API_KEY)
//  🔗 pollinations.ai → Sign in with GitHub → + API Key
//  Free: pollen refills hourly | FLUX Schnell = 0.001 pollen/img
//  .env.local: POLLINATIONS_API_KEY=your_key
// ════════════════════════════════════════════════════════════════════════════
let _polQueue: Promise<void> = Promise.resolve();
let _last429At = 0;
let _consecutive429s = 0;

function getQueueGap(): number {
  const ms = Date.now() - _last429At;
  if (_consecutive429s === 0) return 1000;
  if (ms < 30_000) return 8000;
  if (ms < 120_000) return 4000;
  return 1000;
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const result = _polQueue.then(fn);
  _polQueue = result.then(() => sleep(getQueueGap()), () => sleep(getQueueGap()));
  return result;
}

async function fromPollinations(
  prompt: string,
  seed: number,
  model: "flux" | "flux-pro" | "turbo" = "flux"
): Promise<ArrayBuffer | null> {
  try {
    const freshSeed = (seed * 7919 + Date.now()) % 999983;
    const encoded = encodeURIComponent(buildImagePrompt(prompt));
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&seed=${freshSeed}&nologo=true&enhance=false&model=${model}&cache=false&t=${Date.now()}`;

    console.log(`[img] Trying Pollinations ${model}`);

    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0",
      "Cache-Control": "no-cache",
    };
    const polKey = process.env.POLLINATIONS_API_KEY;
    if (polKey) headers["Authorization"] = `Bearer ${polKey}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), model === "flux-pro" ? 50000 : 35000);
    const res = await fetch(url, { signal: ctrl.signal, headers, cache: "no-store" });
    clearTimeout(timer);

    if (res.status === 429) {
      _last429At = Date.now();
      _consecutive429s++;
      const backoff = Math.min(5000 * _consecutive429s, 20000);
      console.log(`[img] Pollinations 429 (#${_consecutive429s}), backing off ${backoff}ms...`);
      await sleep(backoff);
      const r2 = await fetch(url, { headers, cache: "no-store" }).catch(() => null);
      if (r2?.ok) {
        const ct2 = r2.headers.get("content-type") ?? "";
        if (ct2.startsWith("image/")) {
          const buf = await r2.arrayBuffer();
          if (buf.byteLength > 10000) {
            _consecutive429s = 0;
            console.log(`[img] Pollinations ${model} retry OK (${buf.byteLength} bytes)`);
            return buf;
          }
        }
      }
      return null;
    }

    const ct = res.headers.get("content-type") ?? "";
    if (res.ok && ct.startsWith("image/")) {
      const buffer = await res.arrayBuffer();
      if (buffer.byteLength > 10000) {
        _consecutive429s = Math.max(0, _consecutive429s - 1);
        console.log(`[img] Pollinations ${model} OK (${buffer.byteLength} bytes)`);
        return buffer;
      }
    }
    console.error(`[img] Pollinations ${model}: HTTP ${res.status}`);
    return null;
  } catch (e: unknown) {
    console.error(`[img] Pollinations error: ${e instanceof Error ? e.message.slice(0, 60) : String(e)}`);
    return null;
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  PROVIDER 2 — HuggingFace (FLUX.1-schnell via Inference Providers)
//  🔗 huggingface.co → Settings → Access Tokens → New Token (Read)
//  Free: limited daily calls with free HF account
//  .env.local: HUGGINGFACE_API_KEY=hf_...
// ════════════════════════════════════════════════════════════════════════════
async function fromHuggingFace(prompt: string): Promise<{ buffer: ArrayBuffer; type: string } | null> {
  const key = process.env.HUGGINGFACE_API_KEY;
  if (!key) return null;
  try {
    console.log("[img] Trying HuggingFace FLUX.1-schnell...");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60000);
    const res = await fetch(
      "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",
      {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "x-wait-for-model": "true",
        },
        body: JSON.stringify({ inputs: buildImagePrompt(prompt) }),
      }
    );
    clearTimeout(timer);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[img] HuggingFace ${res.status}: ${body.slice(0, 150)}`);
      return null;
    }
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/")) {
      console.error(`[img] HuggingFace: unexpected content-type ${ct}`);
      return null;
    }
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength < 5000) {
      console.error("[img] HuggingFace: response too small");
      return null;
    }
    console.log(`[img] HuggingFace OK (${buffer.byteLength} bytes)`);
    return { buffer, type: ct };
  } catch (e: unknown) {
    console.error("[img] HuggingFace error:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  MAIN HANDLER
// ════════════════════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  const rawPrompt = req.nextUrl.searchParams.get("prompt") ?? "abstract colorful background";
  const seed = parseInt(req.nextUrl.searchParams.get("seed") ?? "0") || Math.floor(Math.random() * 99999);

  console.log(`\n[img] ===== NEW IMAGE REQUEST =====`);
  console.log(`[img] Prompt: "${rawPrompt.slice(0, 80)}"`);

  const cache = {
    "Cache-Control": "public, max-age=86400",
    "Access-Control-Allow-Origin": "*",
  };

  // 1. Pollinations (authenticated — fast, pollen refills hourly)
  const pol = await enqueue(async () => {
    const polFlux = await fromPollinations(rawPrompt, seed, "flux");
    if (polFlux) return { buf: polFlux, src: "pollinations-flux" };
    const polPro = await fromPollinations(rawPrompt, seed, "flux-pro");
    if (polPro) return { buf: polPro, src: "pollinations-flux-pro" };
    const polTurbo = await fromPollinations(rawPrompt, seed, "turbo");
    if (polTurbo) return { buf: polTurbo, src: "pollinations-turbo" };
    return null;
  });
  if (pol) {
    return new NextResponse(pol.buf, {
      headers: { "Content-Type": "image/jpeg", ...cache, "X-Image-Source": pol.src },
    });
  }

  // 2. HuggingFace (backup when Pollinations fails)
  const hf = await fromHuggingFace(rawPrompt);
  if (hf) {
    return new NextResponse(hf.buffer, {
      headers: { "Content-Type": hf.type, ...cache, "X-Image-Source": "huggingface" },
    });
  }

  // 3. Gradient fallback
  console.log("[img] All providers failed — gradient fallback");
  return gradientFallback(seed);
}

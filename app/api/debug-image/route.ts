import { NextRequest, NextResponse } from "next/server";

/**
 * Debug endpoint — call this to test image generation without the full UI.
 * GET /api/debug-image?prompt=YOUR_PROMPT
 * Returns JSON showing which provider worked, timing, and the image URL.
 */
export async function GET(req: NextRequest) {
  const prompt = req.nextUrl.searchParams.get("prompt") ?? "a child solving math homework at a wooden desk, warm lamp light";
  const seed = Math.floor(Math.random() * 99999);
  const base = req.nextUrl.origin;

  const imageUrl = `${base}/api/image-proxy?seed=${seed}&prompt=${encodeURIComponent(prompt)}`;

  // Fetch the image and inspect headers
  const start = Date.now();
  const res = await fetch(imageUrl);
  const elapsed = Date.now() - start;

  const source = res.headers.get("X-Image-Source") ?? res.headers.get("x-image-source") ?? "unknown";
  const ct = res.headers.get("content-type") ?? "";
  const size = res.headers.get("content-length") ?? "unknown";

  return NextResponse.json({
    prompt,
    built_prompt: prompt + ", photorealistic, sharp focus, professional photography, 4k, no text, no watermarks",
    seed,
    image_url: imageUrl,
    provider: source,
    content_type: ct,
    content_length: size,
    status: res.status,
    elapsed_ms: elapsed,
    instructions: "Open image_url in a new tab to see the result",
  });
}

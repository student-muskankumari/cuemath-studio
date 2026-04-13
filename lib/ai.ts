import { Slidedeck, SlideFormat } from "@/types";

function buildPrompt(userPrompt: string, format: SlideFormat): string {
  const count = format === "carousel" ? "5" : format === "story" ? "4" : "1";
  const size = format === "story" ? "9:16 vertical" : "1:1 square";

  return `You are a social media creative director. Create a ${format} with exactly ${count} slides about: "${userPrompt}". Format: ${size}.

STEP 1 — COPY: Write the text for each slide.
- If format is "post" (1 slide): Write one powerful standalone slide — hook stat + insight + CTA all in one. Headline MAX 5 words. Body MAX 12 words.
- If format is "carousel" (5 slides): Slide 1: Hook. Middle slides: one insight each. Last slide: warm CTA.
- If format is "story" (4 slides): Slide 1: Hook. Middle slides: build tension. Last slide: resolution/CTA.
- Headlines: MAX 5 words. Bodies: MAX 12 words.

STEP 2 — IMAGE: For each slide, write a visual_prompt that is a rich, 40-60 word LITERAL PHOTOGRAPH description of exactly what the slide text says.

STRICT RULE: The image must show what the slide LITERALLY SAYS, not a metaphor or mood.

MAPPING RULE — translate the slide message to a photo scene:
- Slide says "kids forget math" → photo of "a child staring blankly at a math worksheet, pencil down, looking confused, close-up, warm desk lamp"
- Slide says "forgetting curve" → photo of "a student's notebook with faded pencil writing, eraser marks, studying at night, blue lamp light"  
- Slide says "spaced repetition works" → photo of "a child confidently solving math problems at a desk, smiling, morning sunlight, clean workspace"
- Slide says "rise and shine / new possibilities" → photo of "person standing on hilltop at sunrise, arms wide open, golden sky, wide angle, triumphant"
- Slide says "praise kills confidence" → photo of "parent praising child who looks anxious and uncomfortable, indoor lighting, candid moment"
- Slide says "fear of failure" → photo of "child hiding their test paper, looking ashamed, soft natural light, documentary style"

VISUAL_PROMPT FORMULA: Always start with "Generate an image of" then add: [who] + [exact pose/action] + [precise location] + [light source + direction] + [camera: Canon EOS R5 or Sony A7IV] + [lens: 85mm f/1.4 or 35mm f/2] + [color temperature] + [mood] + "hyperrealistic, 8k uhd, award-winning editorial photography"

BAD visual_prompt: "graduation vibes, sparkles, dreamy nostalgic mood" ← WRONG, vague mood not a scene
BAD visual_prompt: "abstract metal structure, industrial" ← WRONG, not related to slide message
BAD visual_prompt: "close-up of a child writing" ← WRONG, missing "Generate an image of" prefix
GOOD visual_prompt: "Generate an image of a close-up of a 10-year-old Indian boy's hands erasing math problems on a worksheet, pencil dust visible, warm amber desk lamp light from the right side, Canon EOS R5, 85mm f/1.4, shallow depth of field, muted golden tones, hyperrealistic, 8k uhd, award-winning editorial photography" ← CORRECT

Return ONLY this raw JSON (no markdown, no backticks):
{
  "slides": [
    {
      "id": "s1",
      "headline": "5 word max headline",
      "body": "12 word max body text",
      "visual_prompt": "Generate an image of [literal photograph scene of what slide says: who+doing+where+lighting+camera+mood+editorial photography]",
      "tone": "hook"
    }
  ],
  "color_palette": ["#hex1", "#hex2", "#hex3"],
  "font_mood": "bold",
  "theme": "one word"
}

tone: hook | explain | example | cta
font_mood: bold | elegant | playful | minimal`;
}
async function callGroq(prompt: string, format: SlideFormat): Promise<Slidedeck> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are a viral social media copywriter. Return only valid raw JSON. No markdown. No backticks. No explanation." },
        { role: "user", content: buildPrompt(prompt, format) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.95,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content) as Slidedeck;
}

async function callGemini(prompt: string, format: SlideFormat): Promise<Slidedeck> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(prompt, format) }] }],
        generationConfig: { response_mime_type: "application/json", temperature: 0.95 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  return JSON.parse(data.candidates[0].content.parts[0].text) as Slidedeck;
}

async function callMistral(prompt: string, format: SlideFormat): Promise<Slidedeck> {
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistral-small-latest",
      messages: [
        { role: "system", content: "You are a viral social media copywriter. Return only valid raw JSON. No markdown. No backticks." },
        { role: "user", content: buildPrompt(prompt, format) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.95,
    }),
  });
  if (!res.ok) throw new Error(`Mistral ${res.status}`);
  const data = await res.json();
  const text = data.choices[0].message.content.replace(/```json|```/g, "").trim();
  return JSON.parse(text) as Slidedeck;
}

export async function generateSlidedeck(
  prompt: string,
  format: SlideFormat
): Promise<{ data: Slidedeck; provider: string }> {
  const providers = [
    { name: "Groq", fn: () => callGroq(prompt, format) },
    { name: "Gemini", fn: () => callGemini(prompt, format) },
    { name: "Mistral", fn: () => callMistral(prompt, format) },
  ];

  const errors: string[] = [];
  for (const p of providers) {
    try {
      console.log(`[AI] Trying ${p.name}...`);
      const data = await p.fn();
      data.slides = data.slides.map((s, i) => ({ ...s, id: s.id || `s${i + 1}` }));
      console.log(`[AI] ${p.name} succeeded`);
      return { data, provider: p.name };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[AI] ${p.name} failed: ${msg}`);
      errors.push(`${p.name}: ${msg}`);
    }
  }
  throw new Error(`All providers failed: ${errors.join(" | ")}`);
}

// ── Refine a slide's text fields via LLM ──────────────────────────────────────
export async function refineSlideText(
  currentHeadline: string,
  currentBody: string,
  currentTone: string,
  instruction: string
): Promise<{ headline: string; body: string; tone: string; visual_prompt?: string }> {
  const sysPrompt = `You are a viral social media copywriter. Given a slide text and an instruction, return ONLY raw JSON improving the text.
Rules: Headline MAX 5 words. Body MAX 12 words. Keep emotional punch. Apply the instruction.
IMPORTANT: Also update visual_prompt to be a LITERAL PHOTOGRAPH of the new slide message. Always start the visual_prompt with "Generate an image of" followed by: who+doing+where+lighting+camera+style.
Respond ONLY with: {"headline":"...","body":"...","tone":"hook|explain|example|cta","visual_prompt":"Generate an image of [literal photo scene matching the new slide text]"}`;

  const userMsg = `Current slide:\nHEADLINE: ${currentHeadline}\nBODY: ${currentBody}\nTONE: ${currentTone}\n\nInstruction: ${instruction}\n\nImprove this slide based on the instruction. Return raw JSON only.`;

  const providers = [
    async () => {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "system", content: sysPrompt }, { role: "user", content: userMsg }],
          response_format: { type: "json_object" },
          temperature: 0.85,
        }),
      });
      if (!res.ok) throw new Error(`Groq ${res.status}`);
      const d = await res.json();
      return JSON.parse(d.choices[0].message.content);
    },
    async () => {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: sysPrompt + "\n\n" + userMsg }] }],
            generationConfig: { response_mime_type: "application/json", temperature: 0.85 },
          }),
        }
      );
      if (!res.ok) throw new Error(`Gemini ${res.status}`);
      const d = await res.json();
      return JSON.parse(d.candidates[0].content.parts[0].text);
    },
  ];

  for (const fn of providers) {
    try { return await fn(); } catch { /* next */ }
  }
  throw new Error("All providers failed for text refine");
}

// ── Evolve a visual_prompt via LLM for image regeneration ────────────────────
export async function refineVisualPrompt(
  currentVisualPrompt: string,
  instruction: string
): Promise<string> {
  const sysPrompt = `You are a professional AI image director specializing in editorial photography for social media.
Given a current image prompt and a user refinement instruction, return ONLY the improved prompt string — no JSON, no quotes, no explanation.

RULES:
- Always START your output with "Generate an image of" — this is mandatory
- Output must be 40-60 words minimum after the prefix — rich and specific
- Keep the SUBJECT and SCENE from the original prompt (the core meaning must stay)
- Apply the user instruction as the PRIMARY visual change
- Always include ALL of these after the prefix: specific subject + exact pose/action + precise location + light source + light direction + camera model (Canon EOS R5 or Sony A7IV) + lens (85mm f/1.4 or 35mm f/2) + color temperature + mood + "hyperrealistic, 8k uhd, award-winning editorial photography"
- Result must be a real photographic scene — not abstract art, not illustration
- Output: "Generate an image of [single detailed paragraph]". No extra quotes. No JSON. No bullet points. No explanation.`;

  const userMsg = `Current prompt: ${currentVisualPrompt}\n\nRefinement instruction: ${instruction}\n\nReturn the improved image prompt as a single line. No quotes, no JSON.`;

  const providers = [
    async () => {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "system", content: sysPrompt }, { role: "user", content: userMsg }],
          temperature: 0.9,
        }),
      });
      if (!res.ok) throw new Error(`Groq ${res.status}`);
      const d = await res.json();
      return d.choices[0].message.content.trim().replace(/^["']|["']$/g, "");
    },
    async () => {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: sysPrompt + "\n\n" + userMsg }] }],
            generationConfig: { temperature: 0.9 },
          }),
        }
      );
      if (!res.ok) throw new Error(`Gemini ${res.status}`);
      const d = await res.json();
      return d.candidates[0].content.parts[0].text.trim().replace(/^["']|["']$/g, "");
    },
  ];

  for (const fn of providers) {
    try { return await fn(); } catch { /* next */ }
  }
  throw new Error("All providers failed for visual prompt refine");
}

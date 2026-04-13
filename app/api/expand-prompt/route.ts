import { NextRequest, NextResponse } from "next/server";

const EXPAND_SYSTEM_PROMPT = `You are a social media creative strategist for Cuemath — an ed-tech brand that creates content for parents about children's math education.

Your job: take a vague, rough, or random idea from a user and transform it into a clear, structured creative brief that will produce a thumb-stopping social media post, story, or carousel.

OUTPUT FORMAT — return ONLY raw JSON, no markdown, no backticks:
{
  "expanded_prompt": "The full structured brief — 2-4 sentences. Must include: the core insight or hook, the narrative arc (what each slide should accomplish), the emotional angle (parent's fear/hope/curiosity), and the CTA direction.",
  "suggested_format": "carousel" | "post" | "story",
  "hook": "A single punchy hook line that would stop a parent mid-scroll",
  "reasoning": "One sentence explaining what you understood from the vague idea and what angle you chose"
}

RULES FOR expanded_prompt:
- Always write for PARENTS of school-age children (6-14 years)
- Lead with a surprising stat, counterintuitive truth, or emotional trigger
- Middle should explain the insight simply — no jargon
- End with a warm, actionable takeaway (not salesy)
- Tone: intelligent but warm, like a trusted teacher talking to a parent
- If the idea is about a math concept, frame it around the CHILD'S EXPERIENCE, not the theory
- If the idea is vague (e.g. "math is hard"), find the most interesting angle — don't be generic

EXAMPLES:

Vague input: "kids and math"
expanded_prompt: "70% of children who struggle with math in Grade 5 were fine in Grade 3 — something breaks in between. Carousel exploring the 3 invisible turning points where math confidence collapses: the jump to fractions, introduction of variables, and timed tests. End with one small habit parents can start tonight."
suggested_format: "carousel"

Vague input: "spaced repetition"
expanded_prompt: "Your child can ace a test on Friday and forget 70% by Monday — that's not laziness, that's how the brain works. Post explaining the forgetting curve in one visual, why cramming is a trap, and the 10-minute weekly review habit that rewires retention permanently."
suggested_format: "post"

Vague input: "exam stress tips"
expanded_prompt: "The night before a math exam, most parents say 'just relax' — but that's exactly the wrong advice. Story walking through what actually happens in a stressed child's brain during exams, the one breathing technique used by competitive chess players, and how to reframe 'I can't do this' into 'I can't do this yet'."
suggested_format: "story"

Vague input: "multiplication"
expanded_prompt: "Most kids memorise multiplication tables — but 60% can't apply them 6 months later. Carousel showing the difference between memorising and understanding multiplication, with 3 real examples of how understanding (not drilling) makes mental math feel like a superpower. Ends with a 5-minute game parents can play at dinner."
suggested_format: "carousel"`;

export async function POST(req: NextRequest) {
  const { vague_prompt } = await req.json();

  if (!vague_prompt || vague_prompt.trim().length < 3) {
    return NextResponse.json({ success: false, error: "Prompt too short." }, { status: 400 });
  }

  const userMsg = `Vague idea from user: "${vague_prompt.trim()}"\n\nExpand this into a structured creative brief. Return raw JSON only.`;

  // Try Groq first (fastest), then Gemini, then Mistral
  const providers = [
    async () => {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: EXPAND_SYSTEM_PROMPT },
            { role: "user", content: userMsg },
          ],
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
            contents: [{ parts: [{ text: EXPAND_SYSTEM_PROMPT + "\n\n" + userMsg }] }],
            generationConfig: { response_mime_type: "application/json", temperature: 0.85 },
          }),
        }
      );
      if (!res.ok) throw new Error(`Gemini ${res.status}`);
      const d = await res.json();
      return JSON.parse(d.candidates[0].content.parts[0].text);
    },
    async () => {
      const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "mistral-small-latest",
          messages: [
            { role: "system", content: EXPAND_SYSTEM_PROMPT },
            { role: "user", content: userMsg },
          ],
          response_format: { type: "json_object" },
          temperature: 0.85,
        }),
      });
      if (!res.ok) throw new Error(`Mistral ${res.status}`);
      const d = await res.json();
      const text = d.choices[0].message.content.replace(/```json|```/g, "").trim();
      return JSON.parse(text);
    },
  ];

  for (const fn of providers) {
    try {
      const result = await fn();
      return NextResponse.json({ success: true, ...result });
    } catch { /* try next */ }
  }

  return NextResponse.json({ success: false, error: "All providers failed." }, { status: 500 });
}

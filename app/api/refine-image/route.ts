import { NextRequest, NextResponse } from "next/server";
import { refineVisualPrompt } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const { visual_prompt, instruction } = await req.json();
    if (!instruction?.trim()) {
      return NextResponse.json({ success: false, error: "Instruction required." }, { status: 400 });
    }

    // Use LLM to evolve the visual prompt
    const newVisualPrompt = await refineVisualPrompt(visual_prompt, instruction);

    // Build the new image URL via image-proxy
    const seed = Date.now() % 9999;
    const base = req.nextUrl.origin;
    const imageUrl = `${base}/api/image-proxy?seed=${seed}&prompt=${encodeURIComponent(newVisualPrompt)}`;

    return NextResponse.json({ success: true, visual_prompt: newVisualPrompt, imageUrl });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}

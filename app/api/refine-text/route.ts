import { NextRequest, NextResponse } from "next/server";
import { refineSlideText } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const { headline, body, tone, instruction } = await req.json();
    if (!instruction?.trim()) {
      return NextResponse.json({ success: false, error: "Instruction required." }, { status: 400 });
    }
    const result = await refineSlideText(headline, body, tone, instruction);

    // If LLM returned a new visual_prompt, build a new imageUrl too
    let imageUrl: string | undefined;
    if (result.visual_prompt) {
      const seed = Math.floor(Math.random() * 99999);
      const base = req.nextUrl.origin;
      imageUrl = `${base}/api/image-proxy?seed=${seed}&prompt=${encodeURIComponent(result.visual_prompt)}`;
    }

    return NextResponse.json({ success: true, ...result, imageUrl });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}

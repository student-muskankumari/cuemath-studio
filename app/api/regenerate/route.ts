import { NextRequest, NextResponse } from "next/server";
import { generateSlidedeck } from "@/lib/ai";
import { SlideFormat } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const { prompt, format, slideIndex } = await req.json();
    const { data } = await generateSlidedeck(prompt, format as SlideFormat);
    const idx = Math.min(slideIndex ?? 0, data.slides.length - 1);
    const slide = data.slides[idx];
    const seed = Date.now() % 9999;
    const base = req.nextUrl.origin;
    slide.imageUrl = `${base}/api/image-proxy?seed=${seed}&prompt=${encodeURIComponent(slide.visual_prompt)}`;
    return NextResponse.json({ success: true, slide });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}

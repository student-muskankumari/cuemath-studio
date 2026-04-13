import { NextRequest, NextResponse } from "next/server";
import { generateSlidedeck } from "@/lib/ai";
import { GenerateRequest } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body: GenerateRequest = await req.json();
    if (!body.prompt || body.prompt.trim().length < 5) {
      return NextResponse.json({ success: false, error: "Prompt too short." }, { status: 400 });
    }

    const format = body.format ?? "carousel";
    const { data, provider } = await generateSlidedeck(body.prompt, format);
    const base = req.nextUrl.origin;

    data.slides = data.slides.map((slide, i) => {
      // Use a random seed per slide — never fixed, so image proxy can't serve stale cache
      const seed = Math.floor(Math.random() * 99999);
      return {
        ...slide,
        imageUrl: `${base}/api/image-proxy?seed=${seed}&prompt=${encodeURIComponent(slide.visual_prompt)}`,
      };
    });

    return NextResponse.json({ success: true, data, provider });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}

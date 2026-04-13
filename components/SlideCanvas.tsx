"use client";
import { useState, useEffect } from "react";
import { Slide, SlideFormat, FontMood, FONT_MOOD_MAP } from "@/types";

interface Props {
  slide: Slide;
  format: SlideFormat;
  index: number;
  palette: string[];
  fontMood?: FontMood;
  isSelected?: boolean;
  onSelect?: () => void;
  onDragStart?: () => void;
  onDragOver?: () => void;
  onDrop?: () => void;
}

const TONE_LABEL: Record<string, string> = {
  hook: "🪝 Hook", explain: "💡 Explain", example: "📌 Example", cta: "🎯 CTA",
};

// Thumbnail version (left strip)
export default function SlideCanvas({
  slide, format, index, palette, fontMood = "bold",
  isSelected, onSelect, onDragStart, onDragOver, onDrop,
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const isStory = format === "story";
  const accent = palette[index % palette.length] ?? "#FF5C00";
  const fonts = FONT_MOOD_MAP[fontMood];

  useEffect(() => { setLoaded(false); setError(false); }, [slide.imageUrl]);

  return (
    <div
      onClick={onSelect}
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); onDragOver?.(); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={() => { setIsDragOver(false); onDrop?.(); }}
      className={`slide-card relative overflow-hidden rounded-xl cursor-pointer border-2 transition-all select-none
        ${isSelected ? "border-orange-500 shadow-lg shadow-orange-500/20" : "border-transparent"}
        ${isDragOver ? "slide-drag-over" : ""}`}
      style={{ aspectRatio: isStory ? "9/16" : "1/1", background: "#1a1a2e" }}
    >
      {!loaded && !error && <div className="absolute inset-0 shimmer" />}
      {!loaded && !error && slide.imageUrl && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="w-4 h-4 border-2 border-white/10 border-t-white/50 rounded-full animate-spin" />
        </div>
      )}
      {slide.imageUrl && !error && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={slide.imageUrl} alt="" crossOrigin="anonymous"
          onLoad={() => setLoaded(true)} onError={() => setError(true)}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.4s" }} />
      )}
      <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom,rgba(0,0,0,0.05) 0%,rgba(0,0,0,0.6) 55%,rgba(0,0,0,0.92) 100%)" }} />
      {/* Accent bar */}
      <div className="absolute top-0 inset-x-0 h-0.5" style={{ background: accent }} />
      {/* Slide number */}
      <div className="absolute top-2 left-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
        style={{ background: "rgba(255,255,255,0.15)" }}>{index + 1}</div>
      {/* Text */}
      <div className="absolute bottom-0 inset-x-0 p-3">
        <p className="font-bold text-white text-xs leading-tight line-clamp-2"
          style={{ fontFamily: fonts.display }}>{slide.headline}</p>
        <p className="text-white/55 text-[10px] mt-0.5 leading-snug line-clamp-2"
          style={{ fontFamily: fonts.body }}>{slide.body}</p>
      </div>
      {/* Drag handle hint */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
        <div className="text-white/20 text-xs">⠿</div>
      </div>
    </div>
  );
}

// Full-size preview (center canvas)
export function SlidePreview({ slide, format, palette, index, fontMood = "bold" }:
  Omit<Props, "isSelected" | "onSelect" | "onDragStart" | "onDragOver" | "onDrop">) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const isStory = format === "story";
  const accent = palette[index % palette.length] ?? "#FF5C00";
  const fonts = FONT_MOOD_MAP[fontMood];

  useEffect(() => { setLoaded(false); setError(false); }, [slide.imageUrl]);

  return (
    <div className="relative overflow-hidden rounded-2xl w-full shadow-2xl"
      style={{ aspectRatio: isStory ? "9/16" : "1/1", background: "#1a1a2e", maxHeight: isStory ? "70vh" : undefined }}>
      {!loaded && !error && <div className="absolute inset-0 shimmer" />}
      {!loaded && !error && slide.imageUrl && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-3">
          <div className="w-7 h-7 border-2 border-white/10 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-white/25 text-xs">Generating image…</p>
        </div>
      )}
      {slide.imageUrl && !error && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={slide.imageUrl} alt="" crossOrigin="anonymous"
          onLoad={() => setLoaded(true)} onError={() => setError(true)}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.5s" }} />
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <p className="text-white/30 text-sm">Image failed to load</p>
          <p className="text-white/15 text-xs text-center px-8">Check API keys in .env.local</p>
        </div>
      )}
      {/* Gradient overlay */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom,rgba(0,0,0,0.05) 0%,rgba(0,0,0,0.55) 45%,rgba(0,0,0,0.9) 100%)" }} />
      {/* Accent bar */}
      <div className="absolute top-0 inset-x-0 h-1" style={{ background: accent }} />
      {/* Content */}
      <div className="absolute bottom-0 inset-x-0 p-8">
        <h2 className="font-bold text-white leading-tight mb-3"
          style={{
            fontFamily: fonts.display,
            fontWeight: fonts.weight,
            fontSize: isStory ? "clamp(22px, 4vw, 36px)" : "clamp(24px, 3.5vw, 40px)",
          }}>
          {slide.headline}
        </h2>
        <p className="text-white/70 leading-relaxed"
          style={{
            fontFamily: fonts.body,
            fontSize: isStory ? "clamp(13px, 2vw, 17px)" : "clamp(14px, 1.8vw, 18px)",
          }}>
          {slide.body}
        </p>
      </div>
    </div>
  );
}

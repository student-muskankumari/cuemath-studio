"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Slide, Slidedeck, SlideFormat, FontMood, BRAND_PALETTES, FONT_MOOD_MAP } from "@/types";
import SlideCanvas, { SlidePreview } from "@/components/SlideCanvas";
import SlideEditor from "@/components/SlideEditor";
import ExportButton from "@/components/ExportButton";

const FONT_MOODS: FontMood[] = ["bold", "elegant", "playful", "minimal"];

export default function StudioPage() {
  const router = useRouter();
  const [deck, setDeck] = useState<Slidedeck | null>(null);
  const [format, setFormat] = useState<SlideFormat>("carousel");
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState("");
  const [selected, setSelected] = useState(0);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [showPaletteMenu, setShowPaletteMenu] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("deck");
    if (!raw) { router.push("/"); return; }
    setDeck(JSON.parse(raw));
    setFormat((sessionStorage.getItem("format") as SlideFormat) ?? "carousel");
    setPrompt(sessionStorage.getItem("prompt") ?? "");
    setProvider(sessionStorage.getItem("provider") ?? "");
  }, [router]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!deck) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") setSelected(s => Math.max(0, s - 1));
      if (e.key === "ArrowRight" || e.key === "ArrowDown") setSelected(s => Math.min(deck.slides.length - 1, s + 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [deck]);

  const regenMutation = useMutation({
    mutationFn: async (idx: number) => {
      const res = await fetch("/api/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, format, slideIndex: idx }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return { slide: data.slide as Slide, idx };
    },
    onSuccess: ({ slide, idx }) => {
      setDeck(prev => {
        if (!prev) return prev;
        const slides = [...prev.slides];
        slides[idx] = slide;
        return { ...prev, slides };
      });
    },
  });

  const updateSlide = useCallback((idx: number, updated: Slide) => {
    setDeck(prev => {
      if (!prev) return prev;
      const slides = [...prev.slides];
      slides[idx] = updated;
      return { ...prev, slides };
    });
  }, []);

  const addSlide = () => {
    if (!deck) return;
    const seed = Math.floor(Math.random() * 99999);
    const newSlide: Slide = {
      id: `s${Date.now()}`,
      headline: "New slide",
      body: "Add your text here.",
      visual_prompt: "soft abstract bokeh background, warm amber light, editorial photography",
      tone: "explain",
      imageUrl: `/api/image-proxy?seed=${seed}&prompt=${encodeURIComponent("soft abstract warm bokeh background")}`,
    };
    setDeck({ ...deck, slides: [...deck.slides, newSlide] });
    setSelected(deck.slides.length);
  };

  const deleteSlide = () => {
    if (!deck || deck.slides.length <= 1) return;
    const slides = deck.slides.filter((_, i) => i !== selected);
    setDeck({ ...deck, slides });
    setSelected(Math.max(0, selected - 1));
  };

  const reorderSlides = (fromIdx: number, toIdx: number) => {
    if (!deck || fromIdx === toIdx) return;
    const slides = [...deck.slides];
    const [moved] = slides.splice(fromIdx, 1);
    slides.splice(toIdx, 0, moved);
    setDeck({ ...deck, slides });
    setSelected(toIdx);
  };

  const setFontMood = (mood: FontMood) => {
    if (!deck) return;
    setDeck({ ...deck, font_mood: mood });
  };

  const setPalette = (colors: string[]) => {
    if (!deck) return;
    setDeck({ ...deck, color_palette: colors });
    setShowPaletteMenu(false);
  };

  if (!deck) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0A0A0F" }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-orange-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-white/30 text-sm">Loading studio…</p>
        </div>
      </div>
    );
  }

  const slide = deck.slides[selected];
  const fontMood = deck.font_mood ?? "bold";

  // Tone color map for storytelling progress bar
  const TONE_COLOR: Record<string, string> = {
    hook: "#FF5C00", explain: "#6C2BD9", example: "#0EA5E9", cta: "#22C55E",
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0A0A0F" }}>

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="border-b px-5 py-2.5 flex items-center justify-between sticky top-0 z-20 gap-3"
        style={{ background: "#13131A", borderColor: "#2A2A3A" }}>
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => router.push("/")} className="text-white/40 hover:text-white text-sm transition-colors shrink-0">
            ← Back
          </button>
          <div className="w-px h-4 bg-white/10 shrink-0" />
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-display text-sm font-bold text-white shrink-0 capitalize">{format}</span>
            <span className="text-white/20">·</span>
            <span className="text-white/40 text-sm shrink-0">{deck.slides.length} slides</span>
            {provider && (
              <span className="text-[11px] px-2 py-0.5 rounded-full border text-white/25 shrink-0 hidden sm:block"
                style={{ borderColor: "#2A2A3A" }}>
                via {provider}
              </span>
            )}
          </div>
        </div>

        {/* Theme controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Font mood pills */}
          <div className="hidden md:flex items-center gap-1 border rounded-lg px-1.5 py-1" style={{ borderColor: "#2A2A3A" }}>
            {FONT_MOODS.map(m => (
              <button key={m} onClick={() => setFontMood(m)}
                className="px-2 py-0.5 rounded-md text-[11px] transition-all capitalize"
                style={{
                  background: fontMood === m ? "rgba(255,92,0,0.15)" : "transparent",
                  color: fontMood === m ? "#FF5C00" : "rgba(255,255,255,0.3)",
                }}>
                {m}
              </button>
            ))}
          </div>

          {/* Palette picker */}
          <div className="relative">
            <button onClick={() => setShowPaletteMenu(v => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs text-white/40 hover:text-white transition-all"
              style={{ borderColor: "#2A2A3A" }}>
              {deck.color_palette.slice(0, 3).map((c, i) => (
                <div key={i} className="w-3 h-3 rounded-full border border-white/10" style={{ background: c }} />
              ))}
              <span className="hidden sm:block">Theme</span>
            </button>
            {showPaletteMenu && (
              <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border p-2 shadow-2xl z-50"
                style={{ background: "#13131A", borderColor: "#2A2A3A" }}>
                <p className="text-[10px] text-white/25 uppercase tracking-wider px-2 mb-2">Color Palettes</p>
                {Object.values(BRAND_PALETTES).map(p => (
                  <button key={p.name} onClick={() => setPalette(p.colors)}
                    className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors text-left">
                    <div className="flex gap-0.5">
                      {p.colors.map((c, i) => (
                        <div key={i} className="w-4 h-4 rounded-sm border border-white/10" style={{ background: c }} />
                      ))}
                    </div>
                    <span className="text-xs text-white/60">{p.label}</span>
                  </button>
                ))}
                {/* Custom palette row */}
                <div className="border-t mt-2 pt-2" style={{ borderColor: "#2A2A3A" }}>
                  <p className="text-[10px] text-white/20 px-2 mb-1.5">Current custom</p>
                  <div className="flex items-center gap-1 px-2">
                    {deck.color_palette.map((c, i) => (
                      <div key={i} title={c} className="w-6 h-6 rounded border border-white/10 cursor-pointer" style={{ background: c }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <ExportButton slides={deck.slides} format={format} palette={deck.color_palette} fontMood={fontMood} />
        </div>
      </header>

      {/* ── Storytelling arc bar (carousel only) ─────────────────── */}
      {format === "carousel" && (
        <div className="border-b px-5 py-2 flex items-center gap-2" style={{ borderColor: "#1a1a2a", background: "#0F0F18" }}>
          <span className="text-[10px] text-white/20 uppercase tracking-wider shrink-0">Story arc</span>
          <div className="flex items-center gap-1 flex-1 overflow-x-auto">
            {deck.slides.map((s, i) => (
              <button key={s.id} onClick={() => setSelected(i)}
                className="flex items-center gap-1 px-2 py-1 rounded-md transition-all shrink-0"
                style={{ background: selected === i ? "rgba(255,255,255,0.06)" : "transparent" }}>
                <div className="w-2 h-2 rounded-full pulse-dot" style={{ background: TONE_COLOR[s.tone] ?? "#888" }} />
                <span className="text-[10px] text-white/40 capitalize">{s.tone}</span>
                {i < deck.slides.length - 1 && <span className="text-white/15 text-[10px] ml-1">→</span>}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-white/15 shrink-0">↑↓ or ←→ to navigate</span>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: Slide strip ─────────────────────────────────── */}
        <aside className="w-56 border-r overflow-y-auto p-3 space-y-2.5 flex-shrink-0"
          style={{ borderColor: "#2A2A3A" }}>
          <p className="text-[10px] text-white/20 uppercase tracking-widest font-medium px-1 mb-1">Slides</p>
          {deck.slides.map((s, i) => (
            <SlideCanvas
              key={s.id}
              slide={s} format={format} index={i}
              palette={deck.color_palette} fontMood={fontMood}
              isSelected={selected === i}
              onSelect={() => setSelected(i)}
              onDragStart={() => setDragIdx(i)}
              onDragOver={() => { if (dragIdx !== null && dragIdx !== i) reorderSlides(dragIdx, i); setDragIdx(i); }}
              onDrop={() => setDragIdx(null)}
            />
          ))}
          <button onClick={addSlide}
            className="w-full py-3 rounded-xl border text-xs text-white/30 hover:text-white/60 hover:border-white/20 transition-all"
            style={{ borderColor: "#2A2A3A", borderStyle: "dashed" }}>
            + Add slide
          </button>
        </aside>

        {/* ── Center: Preview ───────────────────────────────────── */}
        <main className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
          <div className="w-full" style={{ maxWidth: format === "story" ? "340px" : "480px" }}>
            <SlidePreview slide={slide} format={format} palette={deck.color_palette} index={selected} fontMood={fontMood} />

            {/* Below canvas: palette dots + theme + slide nav */}
            <div className="flex items-center justify-between mt-4 px-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-white/20">Palette</span>
                {deck.color_palette.map((c, i) => (
                  <div key={i} title={c} className="w-3.5 h-3.5 rounded-full border border-white/10" style={{ background: c }} />
                ))}
                <span className="text-[11px] text-white/15 ml-1 italic">{deck.theme}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setSelected(s => Math.max(0, s - 1))} disabled={selected === 0}
                  className="w-7 h-7 rounded-lg border flex items-center justify-center text-white/30 hover:text-white disabled:opacity-20 transition-all text-sm"
                  style={{ borderColor: "#2A2A3A" }}>‹</button>
                <span className="text-xs text-white/30">{selected + 1} / {deck.slides.length}</span>
                <button onClick={() => setSelected(s => Math.min(deck.slides.length - 1, s + 1))} disabled={selected === deck.slides.length - 1}
                  className="w-7 h-7 rounded-lg border flex items-center justify-center text-white/30 hover:text-white disabled:opacity-20 transition-all text-sm"
                  style={{ borderColor: "#2A2A3A" }}>›</button>
              </div>
            </div>
          </div>
        </main>

        {/* ── Right: Editor ─────────────────────────────────────── */}
        <aside className="w-72 border-l overflow-y-auto p-4 flex-shrink-0" style={{ borderColor: "#2A2A3A" }}>
          <p className="text-[10px] text-white/20 uppercase tracking-widest font-medium mb-3">Edit slide {selected + 1}</p>
          <SlideEditor
            slide={slide}
            onUpdate={(updated) => updateSlide(selected, updated)}
            onRegenerate={() => regenMutation.mutate(selected)}
            isRegenerating={regenMutation.isPending}
          />
          {regenMutation.isError && (
            <div className="mt-2 p-2 rounded-lg text-xs text-red-400 border border-red-900/30 bg-red-950/20">
              {regenMutation.error instanceof Error ? regenMutation.error.message : "Regeneration failed"}
            </div>
          )}

          {/* Original prompt */}
          <div className="mt-3 p-3 rounded-xl border text-xs text-white/30 leading-relaxed"
            style={{ borderColor: "#2A2A3A", background: "rgba(255,255,255,0.01)" }}>
            <p className="text-white/15 text-[10px] uppercase tracking-wider mb-1.5">Original prompt</p>
            {prompt}
          </div>

          {/* Font mood (mobile fallback) */}
          <div className="mt-3 md:hidden">
            <p className="text-[10px] text-white/20 uppercase tracking-wider mb-2">Font style</p>
            <div className="flex gap-1.5 flex-wrap">
              {FONT_MOODS.map(m => (
                <button key={m} onClick={() => setFontMood(m)}
                  className="px-2.5 py-1 rounded-md text-xs transition-all capitalize"
                  style={{
                    background: fontMood === m ? "rgba(255,92,0,0.15)" : "rgba(255,255,255,0.05)",
                    color: fontMood === m ? "#FF5C00" : "rgba(255,255,255,0.35)",
                  }}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Delete */}
          {deck.slides.length > 1 && (
            <button onClick={deleteSlide}
              className="mt-3 w-full py-2 rounded-xl text-xs text-red-500/30 hover:text-red-400 transition-colors border"
              style={{ borderColor: "rgba(239,68,68,0.1)" }}>
              Delete this slide
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}

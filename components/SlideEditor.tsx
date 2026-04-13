"use client";
import { useState, useEffect } from "react";
import { Slide, SlideTone, PromptHistoryEntry } from "@/types";

interface Props {
  slide: Slide;
  onUpdate: (s: Slide) => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

const TONES: SlideTone[] = ["hook", "explain", "example", "cta"];
const TONE_ICONS: Record<SlideTone, string> = {
  hook: "🪝", explain: "💡", example: "📌", cta: "🎯",
};

type Tab = "edit" | "ai" | "image";

// Two-stage refine progress
type RefineStage = "idle" | "evolving" | "generating" | "done" | "error";

export default function SlideEditor({ slide, onUpdate, onRegenerate, isRegenerating }: Props) {
  const [tab, setTab] = useState<Tab>("edit");
  const [editingField, setEditingField] = useState<"headline" | "body" | null>(null);

  // AI text refine
  const [textInstruction, setTextInstruction] = useState("");
  const [isRefiningText, setIsRefiningText] = useState(false);
  const [textError, setTextError] = useState("");

  // Image refine — two-stage with live preview
  const [imageInstruction, setImageInstruction] = useState("");
  const [refineStage, setRefineStage] = useState<RefineStage>("idle");
  const [imageError, setImageError] = useState("");
  const [newVisualPrompt, setNewVisualPrompt] = useState<string | null>(null);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [editingVisualPrompt, setEditingVisualPrompt] = useState(false);
  const [visualPromptDraft, setVisualPromptDraft] = useState(slide.visual_prompt);

  useEffect(() => {
    setVisualPromptDraft(slide.visual_prompt);
    // reset refine state when slide changes
    setRefineStage("idle");
    setNewVisualPrompt(null);
    setPendingImageUrl(null);
    setPreviewLoaded(false);
    setPreviewError(false);
  }, [slide.id, slide.visual_prompt]);

  // When pendingImageUrl is set, start loading preview
  useEffect(() => {
    if (!pendingImageUrl) return;
    setPreviewLoaded(false);
    setPreviewError(false);
    setRefineStage("generating");
  }, [pendingImageUrl]);

  const history: PromptHistoryEntry[] = slide.promptHistory ?? [];

  // ── AI Text Refine ────────────────────────────────────────────────────────
  async function handleRefineText() {
    if (!textInstruction.trim()) return;
    setIsRefiningText(true);
    setTextError("");
    try {
      const res = await fetch("/api/refine-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headline: slide.headline, body: slide.body, tone: slide.tone, instruction: textInstruction }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      const entry: PromptHistoryEntry = { instruction: textInstruction, type: "text", timestamp: Date.now() };
      onUpdate({
        ...slide,
        headline: data.headline ?? slide.headline,
        body: data.body ?? slide.body,
        tone: (data.tone as SlideTone) ?? slide.tone,
        ...(data.visual_prompt ? { visual_prompt: data.visual_prompt } : {}),
        ...(data.imageUrl ? { imageUrl: data.imageUrl } : {}),
        promptHistory: [...history, entry],
      });
      setTextInstruction("");
    } catch (e) {
      setTextError(e instanceof Error ? e.message : "Failed to refine text");
    } finally {
      setIsRefiningText(false);
    }
  }

  // ── Image Refine — two stages with live preview ───────────────────────────
  async function handleRefineImage() {
    if (!imageInstruction.trim()) return;
    setImageError("");
    setNewVisualPrompt(null);
    setPendingImageUrl(null);
    setPreviewLoaded(false);
    setPreviewError(false);

    // Stage 1: LLM evolves the visual prompt
    setRefineStage("evolving");
    try {
      const res = await fetch("/api/refine-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visual_prompt: slide.visual_prompt, instruction: imageInstruction }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setNewVisualPrompt(data.visual_prompt);
      setPendingImageUrl(data.imageUrl); // Stage 2 starts: image loads in preview

      const entry: PromptHistoryEntry = { instruction: imageInstruction, type: "image", timestamp: Date.now() };

      // Apply new visual_prompt immediately — image will stream in via <img>
      onUpdate({
        ...slide,
        visual_prompt: data.visual_prompt,
        imageUrl: data.imageUrl,
        promptHistory: [...history, entry],
      });

      setImageInstruction("");
      // Stage stays as "generating" until preview image loads
    } catch (e) {
      setRefineStage("error");
      setImageError(e instanceof Error ? e.message : "Failed to refine image");
    }
  }

  function handlePreviewLoaded() {
    setPreviewLoaded(true);
    setRefineStage("done");
    // Auto-reset to idle after 3s
    setTimeout(() => setRefineStage("idle"), 3000);
  }

  function handlePreviewError() {
    setPreviewError(true);
    setRefineStage("error");
    setImageError("Image failed to generate. Try again.");
  }

  function handleSaveVisualPrompt() {
    onUpdate({ ...slide, visual_prompt: visualPromptDraft });
    setEditingVisualPrompt(false);
  }

  function handleRegenerateWithNewPrompt() {
    onUpdate({ ...slide, visual_prompt: visualPromptDraft });
    setEditingVisualPrompt(false);
    setTimeout(() => onRegenerate(), 100);
  }

  const isRefiningImage = refineStage === "evolving" || refineStage === "generating";

  // Stage labels
  const STAGE_LABEL: Record<RefineStage, string> = {
    idle:       "🎨 Refine Image with AI",
    evolving:   "✦ Evolving prompt…",
    generating: "🖼 Generating image…",
    done:       "✓ Done — image updated",
    error:      "⚠ Failed — try again",
  };

  const STAGE_COLOR: Record<RefineStage, string> = {
    idle:       "linear-gradient(135deg,#FF5C00,#6C2BD9)",
    evolving:   "linear-gradient(135deg,#6C2BD9,#3B82F6)",
    generating: "linear-gradient(135deg,#0EA5E9,#6C2BD9)",
    done:       "linear-gradient(135deg,#22C55E,#16A34A)",
    error:      "linear-gradient(135deg,#EF4444,#B91C1C)",
  };

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "#13131A", borderColor: "#2A2A3A" }}>

      {/* Tab bar */}
      <div className="flex border-b" style={{ borderColor: "#2A2A3A" }}>
        {(["edit", "ai", "image"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-2.5 text-xs font-medium transition-all relative"
            style={{
              color: tab === t ? "#FF5C00" : "rgba(255,255,255,0.35)",
              borderBottom: tab === t ? "2px solid #FF5C00" : "2px solid transparent",
              background: "transparent",
            }}>
            {t === "edit" && "✎ Edit"}
            {t === "ai" && "✦ AI Text"}
            {t === "image" && (
              <span className="flex items-center justify-center gap-1">
                🎨 Image
                {/* Dot indicator when refining */}
                {isRefiningImage && (
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                )}
                {refineStage === "done" && tab !== "image" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                )}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">

        {/* ── EDIT TAB ──────────────────────────────────────────── */}
        {tab === "edit" && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/25 uppercase tracking-widest">Quick actions</span>
              <button onClick={onRegenerate} disabled={isRegenerating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border text-white/50 hover:text-orange-400 hover:border-orange-500 transition-all disabled:opacity-40"
                style={{ borderColor: "#2A2A3A" }}>
                {isRegenerating ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : "↻"} Regenerate
              </button>
            </div>

            <div>
              <label className="text-[10px] text-white/30 uppercase tracking-wider mb-1 block">Headline</label>
              {editingField === "headline"
                ? <textarea autoFocus rows={2} value={slide.headline}
                    onChange={(e) => onUpdate({ ...slide, headline: e.target.value })}
                    onBlur={() => setEditingField(null)}
                    className="w-full rounded-lg p-2 text-sm text-white bg-black/40 border outline-none resize-none"
                    style={{ borderColor: "#FF5C00" }} />
                : <p onClick={() => setEditingField("headline")}
                    className="text-sm text-white p-2 rounded-lg cursor-pointer hover:bg-white/5 transition-colors leading-snug">
                    {slide.headline} <span className="text-white/20 text-xs ml-1">✎</span>
                  </p>
              }
            </div>

            <div>
              <label className="text-[10px] text-white/30 uppercase tracking-wider mb-1 block">Body text</label>
              {editingField === "body"
                ? <textarea autoFocus rows={3} value={slide.body}
                    onChange={(e) => onUpdate({ ...slide, body: e.target.value })}
                    onBlur={() => setEditingField(null)}
                    className="w-full rounded-lg p-2 text-sm text-white bg-black/40 border outline-none resize-none"
                    style={{ borderColor: "#FF5C00" }} />
                : <p onClick={() => setEditingField("body")}
                    className="text-sm text-white/65 p-2 rounded-lg cursor-pointer hover:bg-white/5 transition-colors leading-snug">
                    {slide.body} <span className="text-white/20 text-xs ml-1">✎</span>
                  </p>
              }
            </div>

            <div>
              <label className="text-[10px] text-white/30 uppercase tracking-wider mb-2 block">Tone</label>
              <div className="flex gap-1.5 flex-wrap">
                {TONES.map((t) => (
                  <button key={t} onClick={() => onUpdate({ ...slide, tone: t })}
                    className="px-2.5 py-1 rounded-md text-xs transition-all flex items-center gap-1"
                    style={{
                      background: slide.tone === t ? "#FF5C00" : "rgba(255,255,255,0.06)",
                      color: slide.tone === t ? "#fff" : "rgba(255,255,255,0.4)",
                    }}>
                    <span style={{ fontSize: 11 }}>{TONE_ICONS[t]}</span> {t}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── AI TEXT TAB ───────────────────────────────────────── */}
        {tab === "ai" && (
          <>
            <div className="rounded-lg p-3 border" style={{ background: "#0A0A0F", borderColor: "#2A2A3A" }}>
              <p className="text-white text-sm font-semibold leading-snug mb-1">{slide.headline}</p>
              <p className="text-white/50 text-xs leading-snug">{slide.body}</p>
              <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full"
                style={{ background: "rgba(255,92,0,0.15)", color: "#FF5C00" }}>
                {TONE_ICONS[slide.tone]} {slide.tone}
              </span>
            </div>

            <div>
              <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">Quick instructions</p>
              <div className="flex flex-wrap gap-1.5">
                {["Make it more emotional", "Make it punchier", "Add a surprising stat", "More conversational", "Add urgency", "Warmer tone"].map((ex) => (
                  <button key={ex} onClick={() => setTextInstruction(ex)}
                    className="text-[11px] px-2 py-1 rounded-full border transition-colors hover:border-white/20 hover:text-white/60"
                    style={{ borderColor: "#2A2A3A", color: "rgba(255,255,255,0.3)" }}>
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] text-white/30 uppercase tracking-wider mb-1 block">Your instruction</label>
              <textarea rows={3} value={textInstruction}
                onChange={(e) => setTextInstruction(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleRefineText(); }}
                placeholder={`e.g. "Make this more emotional and add a shocking stat"`}
                className="w-full rounded-lg p-3 text-sm text-white placeholder-white/20 bg-black/40 border outline-none resize-none"
                style={{ borderColor: textInstruction ? "#FF5C00" : "#2A2A3A" }}
              />
              <p className="text-[10px] text-white/20 mt-1">Cmd/Ctrl+Enter to send</p>
            </div>

            {textError && (
              <div className="p-2 rounded-lg text-xs text-red-400 border border-red-900/30 bg-red-950/20">{textError}</div>
            )}

            <button onClick={handleRefineText} disabled={isRefiningText || !textInstruction.trim()}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg,#FF5C00,#6C2BD9)" }}>
              {isRefiningText
                ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Refining…</>
                : "✦ Refine with AI"}
            </button>

            {history.filter(h => h.type === "text").length > 0 && (
              <div>
                <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">History</p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {history.filter(h => h.type === "text").slice().reverse().map((h, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                      <span className="text-orange-500/60 text-[10px] shrink-0 mt-0.5">✦</span>
                      <p className="text-[11px] text-white/40 leading-snug">{h.instruction}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── IMAGE TAB ─────────────────────────────────────────── */}
        {tab === "image" && (
          <>
            {/* Visual prompt display / edit */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] text-white/30 uppercase tracking-wider">Visual prompt</label>
                <button onClick={() => setEditingVisualPrompt(!editingVisualPrompt)}
                  className="text-[10px] px-2 py-0.5 rounded border transition-colors"
                  style={{ borderColor: "#2A2A3A", color: "rgba(255,255,255,0.35)" }}>
                  {editingVisualPrompt ? "cancel" : "edit manually"}
                </button>
              </div>
              {editingVisualPrompt ? (
                <>
                  <textarea rows={4} value={visualPromptDraft}
                    onChange={(e) => setVisualPromptDraft(e.target.value)}
                    className="w-full rounded-lg p-2.5 text-xs text-white/70 bg-black/40 border outline-none resize-none"
                    style={{ borderColor: "#FF5C00" }} />
                  <div className="flex gap-2 mt-2">
                    <button onClick={handleSaveVisualPrompt}
                      className="flex-1 py-1.5 rounded-lg text-xs border text-white/50 hover:text-white hover:border-white/25 transition-all"
                      style={{ borderColor: "#2A2A3A" }}>
                      Save only
                    </button>
                    <button onClick={handleRegenerateWithNewPrompt} disabled={isRegenerating}
                      className="flex-1 py-1.5 rounded-lg text-xs text-white transition-all disabled:opacity-40"
                      style={{ background: "#FF5C00" }}>
                      {isRegenerating ? "Generating…" : "Save + Regen"}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-[11px] text-white/35 leading-relaxed p-2.5 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #1e1e2e" }}>
                  {newVisualPrompt ?? slide.visual_prompt}
                  {newVisualPrompt && newVisualPrompt !== slide.visual_prompt && (
                    <span className="ml-1 text-orange-500/60 text-[10px]">← updated</span>
                  )}
                </p>
              )}
            </div>

            {/* ── Live image preview while generating ─────────────── */}
            {pendingImageUrl && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] text-white/25 uppercase tracking-wider">
                    {refineStage === "generating" ? "Generating new image…" : refineStage === "done" ? "✓ Image updated" : "Preview"}
                  </p>
                  {refineStage === "generating" && (
                    <span className="flex items-center gap-1 text-[10px] text-orange-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                      live
                    </span>
                  )}
                </div>
                <div className="relative rounded-xl overflow-hidden border"
                  style={{ aspectRatio: "1/1", background: "#0A0A0F", borderColor: refineStage === "done" ? "#22C55E" : "#2A2A3A" }}>
                  {/* Shimmer while loading */}
                  {!previewLoaded && !previewError && <div className="absolute inset-0 shimmer" />}
                  {/* Spinner overlay */}
                  {!previewLoaded && !previewError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
                      <div className="w-6 h-6 border-2 border-white/10 border-t-orange-500 rounded-full animate-spin" />
                      <p className="text-white/25 text-[10px] text-center px-4">
                        {refineStage === "evolving" ? "Evolving prompt via AI…" : "Generating image — this takes 5-30s"}
                      </p>
                    </div>
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pendingImageUrl}
                    alt="Preview"
                    className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
                    style={{ opacity: previewLoaded ? 1 : 0 }}
                    onLoad={handlePreviewLoaded}
                    onError={handlePreviewError}
                  />
                  {/* Success checkmark */}
                  {refineStage === "done" && previewLoaded && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs"
                      style={{ background: "#22C55E" }}>✓</div>
                  )}
                  {/* Error state */}
                  {previewError && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-red-400/60 text-xs text-center px-4">Image failed — try a different instruction</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Two-stage progress indicator ─────────────────────── */}
            {(refineStage === "evolving" || refineStage === "generating") && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg border" style={{ borderColor: "#2A2A3A", background: "rgba(255,255,255,0.02)" }}>
                <div className="flex items-center gap-1.5 flex-1">
                  {/* Stage 1 */}
                  <div className="flex items-center gap-1">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold transition-all ${refineStage === "evolving" ? "bg-orange-500 animate-pulse" : "bg-green-500"}`}>
                      {refineStage === "evolving" ? "1" : "✓"}
                    </div>
                    <span className="text-[10px] text-white/40">Evolve prompt</span>
                  </div>
                  <div className="text-white/15 text-xs">→</div>
                  {/* Stage 2 */}
                  <div className="flex items-center gap-1">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold transition-all ${refineStage === "generating" ? "bg-orange-500 animate-pulse" : "bg-white/10"}`}>
                      2
                    </div>
                    <span className="text-[10px] text-white/40">Generate image</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Quick instruction chips ───────────────────────────── */}
            <div>
              <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">Quick refinements</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "More dramatic lighting",
                  "Golden hour light",
                  "Cinematic film grain",
                  "Warmer tones",
                  "Foggy atmosphere",
                  "Night scene",
                  "Add bokeh sparkles",
                  "More minimalist",
                ].map((ex) => (
                  <button key={ex} onClick={() => setImageInstruction(ex)}
                    disabled={isRefiningImage}
                    className="text-[11px] px-2 py-1 rounded-full border transition-colors hover:border-orange-500/40 hover:text-white/60 disabled:opacity-30"
                    style={{ borderColor: "#2A2A3A", color: "rgba(255,255,255,0.3)" }}>
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Instruction textarea ──────────────────────────────── */}
            <div>
              <label className="text-[10px] text-white/30 uppercase tracking-wider mb-1 block">Describe your change</label>
              <textarea rows={3} value={imageInstruction}
                onChange={(e) => setImageInstruction(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !isRefiningImage) handleRefineImage(); }}
                disabled={isRefiningImage}
                placeholder={`e.g. "Make the background more dramatic with storm clouds and moody light"`}
                className="w-full rounded-lg p-3 text-sm text-white placeholder-white/20 bg-black/40 border outline-none resize-none disabled:opacity-40"
                style={{ borderColor: imageInstruction && !isRefiningImage ? "#FF5C00" : "#2A2A3A" }}
              />
              <p className="text-[10px] text-white/20 mt-1">Cmd/Ctrl+Enter · AI evolves prompt then generates</p>
            </div>

            {imageError && (
              <div className="p-2 rounded-lg text-xs text-red-400 border border-red-900/30 bg-red-950/20">{imageError}</div>
            )}

            {/* ── Main CTA button ───────────────────────────────────── */}
            <button
              onClick={handleRefineImage}
              disabled={isRefiningImage || !imageInstruction.trim()}
              className="w-full py-3 rounded-xl text-sm font-medium text-white transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                background: STAGE_COLOR[refineStage],
                opacity: (isRefiningImage || !imageInstruction.trim()) ? 0.7 : 1,
              }}>
              {isRefiningImage
                ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {STAGE_LABEL[refineStage]}</>
                : STAGE_LABEL[refineStage]}
            </button>

            {/* ── Image refinement history ──────────────────────────── */}
            {history.filter(h => h.type === "image").length > 0 && (
              <div>
                <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">Refinement history</p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {history.filter(h => h.type === "image").slice().reverse().map((h, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                      <span className="text-[10px] text-white/20 shrink-0 mt-0.5">🎨</span>
                      <p className="text-[11px] text-white/40 leading-snug">{h.instruction}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

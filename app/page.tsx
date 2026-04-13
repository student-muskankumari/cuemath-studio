"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { SlideFormat, GenerateResponse } from "@/types";

const FORMATS: { value: SlideFormat; label: string; desc: string; icon: string; slides: string }[] = [
  { value: "carousel", label: "Carousel",  desc: "Multi-slide story", icon: "▦", slides: "5 slides" },
  { value: "post",     label: "Post",       desc: "Single 1:1 square",  icon: "◻", slides: "1 slide"  },
  { value: "story",    label: "Story",      desc: "9:16 vertical",       icon: "▯", slides: "4 slides" },
];

const EXAMPLES = [
  { label: "Forgetting Curve",    prompt: "kids forget stuff" },
  { label: "Math Anxiety",        prompt: "kids scared of math exams" },
  { label: "Memorising vs Understanding", prompt: "memorising vs actually getting math" },
  { label: "Praise Backfires",    prompt: "telling kids they're smart backfires" },
  { label: "Screen Time",         prompt: "phones and math focus" },
  { label: "Exam Fear",           prompt: "freezing during math tests" },
];

interface ExpandedResult {
  expanded_prompt: string;
  suggested_format: SlideFormat;
  hook: string;
  reasoning: string;
}

type Stage = "input" | "expanding" | "preview" | "generating";

export default function Home() {
  const router = useRouter();
  const [vaguePrompt, setVaguePrompt] = useState("");
  const [format, setFormat] = useState<SlideFormat>("carousel");
  const [stage, setStage] = useState<Stage>("input");
  const [expanded, setExpanded] = useState<ExpandedResult | null>(null);
  const [finalPrompt, setFinalPrompt] = useState("");
  const [expandError, setExpandError] = useState("");

  // Step 1: Expand vague → structured
  async function handleExpand() {
    if (vaguePrompt.trim().length < 3) return;
    setStage("expanding");
    setExpandError("");
    try {
      const res = await fetch("/api/expand-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vague_prompt: vaguePrompt }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setExpanded(data as ExpandedResult);
      setFinalPrompt(data.expanded_prompt);
      if (data.suggested_format) setFormat(data.suggested_format);
      setStage("preview");
    } catch (e) {
      setExpandError(e instanceof Error ? e.message : "Failed to expand prompt");
      setStage("input");
    }
  }

  // Step 2: Generate deck from expanded prompt
  const generateMutation = useMutation({
    mutationFn: async () => {
      setStage("generating");
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: finalPrompt, format }),
      });
      const data: GenerateResponse = await res.json();
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      sessionStorage.setItem("deck", JSON.stringify(data.data));
      sessionStorage.setItem("prompt", finalPrompt);
      sessionStorage.setItem("format", format);
      sessionStorage.setItem("provider", data.provider ?? "");
      router.push("/studio");
    },
    onError: () => setStage("preview"),
  });

  function handleReset() {
    setStage("input");
    setExpanded(null);
    setFinalPrompt("");
    setExpandError("");
    generateMutation.reset();
  }

  const isLoading = stage === "expanding" || stage === "generating";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16 relative overflow-hidden">
      {/* Background grid */}
      <div className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
      {/* Glow orbs */}
      <div className="fixed top-1/4 left-1/4 w-96 h-96 rounded-full pointer-events-none opacity-10"
        style={{ background: "radial-gradient(circle, #FF5C00 0%, transparent 70%)", filter: "blur(60px)" }} />
      <div className="fixed bottom-1/4 right-1/4 w-96 h-96 rounded-full pointer-events-none opacity-10"
        style={{ background: "radial-gradient(circle, #6C2BD9 0%, transparent 70%)", filter: "blur(60px)" }} />

      {/* Header */}
      <div className="mb-10 text-center animate-fade-up relative z-10">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg"
            style={{ background: "linear-gradient(135deg,#FF5C00,#6C2BD9)" }}>C</div>
          <span className="text-white/50 text-sm font-semibold tracking-widest uppercase">Cuemath</span>
        </div>
        <h1 className="font-display font-bold tracking-tight leading-none mb-2" style={{ fontSize: "clamp(40px, 8vw, 72px)" }}>
          Social Media
        </h1>
        <h1 className="font-display font-bold tracking-tight leading-none mb-4"
          style={{
            fontSize: "clamp(40px, 8vw, 72px)",
            WebkitTextStroke: "1.5px rgba(255,255,255,0.2)",
            WebkitTextFillColor: "transparent",
          }}>
          Studio
        </h1>
        <p className="text-white/35 text-base max-w-sm mx-auto leading-relaxed">
          Throw a rough idea at it. AI sharpens it into a brief, then builds the creative.
        </p>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-3 mt-6">
          {[
            { num: 1, label: "Your idea", active: stage === "input" || stage === "expanding", done: stage === "preview" || stage === "generating" },
            { num: 2, label: "AI expands", active: stage === "expanding", done: stage === "preview" || stage === "generating" },
            { num: 3, label: "Review & generate", active: stage === "preview" || stage === "generating", done: false },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
                  style={{
                    background: step.done ? "#22C55E" : step.active ? "#FF5C00" : "rgba(255,255,255,0.08)",
                    color: step.done || step.active ? "#fff" : "rgba(255,255,255,0.25)",
                  }}>
                  {step.done ? "✓" : step.num}
                </div>
                <span className="text-[11px] hidden sm:block transition-all"
                  style={{ color: step.active ? "rgba(255,255,255,0.7)" : step.done ? "#22C55E" : "rgba(255,255,255,0.2)" }}>
                  {step.label}
                </span>
              </div>
              {i < 2 && <div className="w-6 h-px" style={{ background: "rgba(255,255,255,0.1)" }} />}
            </div>
          ))}
        </div>
      </div>

      {/* Main card */}
      <div className="w-full max-w-2xl relative z-10 animate-fade-up" style={{ animationDelay: "0.1s", opacity: 0 }}>
        <div className="rounded-2xl border overflow-hidden" style={{ background: "#13131A", borderColor: "#2A2A3A" }}>

          {/* ── STAGE: INPUT ─────────────────────────────────────── */}
          {(stage === "input" || stage === "expanding") && (
            <div className="p-6">
              {/* Format picker */}
              <div className="grid grid-cols-3 gap-2 mb-5">
                {FORMATS.map((f) => (
                  <button key={f.value} onClick={() => setFormat(f.value)}
                    className="rounded-xl p-3 border text-left transition-all"
                    style={{
                      borderColor: format === f.value ? "#FF5C00" : "#2A2A3A",
                      background: format === f.value ? "rgba(255,92,0,0.08)" : "rgba(255,255,255,0.01)",
                    }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xl">{f.icon}</span>
                      <span className="text-[10px] text-white/25 font-medium">{f.slides}</span>
                    </div>
                    <div className="font-display text-sm font-bold text-white">{f.label}</div>
                    <div className="text-xs text-white/35 mt-0.5">{f.desc}</div>
                  </button>
                ))}
              </div>

              {/* Input area */}
              <div className="relative mb-3">
                <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium z-10"
                  style={{ background: "rgba(108,43,217,0.2)", color: "#A78BFA", border: "1px solid rgba(108,43,217,0.3)" }}>
                  ✦ AI will expand this
                </div>
                <textarea
                  value={vaguePrompt}
                  onChange={(e) => setVaguePrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && vaguePrompt.trim().length >= 3 && !isLoading)
                      handleExpand();
                  }}
                  disabled={stage === "expanding"}
                  placeholder={"Throw any rough idea here…\ne.g. \"kids forget stuff\" or \"math anxiety\" or \"why practice matters\""}
                  rows={4}
                  className="w-full rounded-xl p-4 pt-10 text-white placeholder-white/20 text-sm resize-none outline-none border transition-all disabled:opacity-60"
                  style={{
                    background: "#0A0A0F",
                    borderColor: vaguePrompt.length > 3 ? "#6C2BD9" : "#2A2A3A",
                    lineHeight: 1.6,
                  }}
                />
                <div className="absolute bottom-3 right-3 text-[10px] text-white/15">
                  {vaguePrompt.length > 3 ? "Cmd+Enter to expand" : ""}
                </div>
              </div>

              {/* Examples */}
              <div className="mb-5">
                <p className="text-[11px] text-white/25 mb-2 uppercase tracking-wider font-medium">Try a vague idea</p>
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLES.map((e) => (
                    <button key={e.label} onClick={() => setVaguePrompt(e.prompt)}
                      className="text-xs px-3 py-1.5 rounded-full border transition-all hover:border-purple-500/50 hover:text-white/70 hover:bg-purple-500/5"
                      style={{ borderColor: "#2A2A3A", color: "rgba(255,255,255,0.35)" }}>
                      {e.label}
                    </button>
                  ))}
                </div>
              </div>

              {expandError && (
                <div className="mb-3 p-3 rounded-xl text-xs text-red-400 border border-red-900/40 bg-red-950/20">
                  ⚠ {expandError}
                </div>
              )}

              <button
                onClick={handleExpand}
                disabled={vaguePrompt.trim().length < 3 || stage === "expanding"}
                className="w-full py-4 rounded-xl font-display font-bold text-white text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg,#6C2BD9,#FF5C00)" }}>
                {stage === "expanding" ? (
                  <span className="flex items-center justify-center gap-3">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>AI is expanding your idea…</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">✦ Expand with AI →</span>
                )}
              </button>
            </div>
          )}

          {/* ── STAGE: PREVIEW ───────────────────────────────────── */}
          {(stage === "preview" || stage === "generating") && expanded && (
            <div className="p-6 space-y-5">

              {/* What AI understood */}
              <div className="rounded-xl p-4 border" style={{ background: "rgba(108,43,217,0.06)", borderColor: "rgba(108,43,217,0.25)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#A78BFA" }}>✦ AI understood</span>
                </div>
                <p className="text-white/50 text-xs leading-relaxed italic">"{expanded.reasoning}"</p>
              </div>

              {/* Hook preview */}
              <div>
                <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">Hook line</p>
                <p className="text-white font-bold text-lg leading-snug" style={{ fontFamily: "'Syne', sans-serif" }}>
                  {expanded.hook}
                </p>
              </div>

              {/* Expanded prompt — editable */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-white/25 uppercase tracking-wider">Creative brief (editable)</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.1)", color: "#22C55E" }}>
                    ✓ AI generated
                  </span>
                </div>
                <textarea
                  value={finalPrompt}
                  onChange={(e) => setFinalPrompt(e.target.value)}
                  rows={5}
                  disabled={stage === "generating"}
                  className="w-full rounded-xl p-4 text-white text-sm resize-none outline-none border transition-all disabled:opacity-60"
                  style={{ background: "#0A0A0F", borderColor: "#FF5C00", lineHeight: 1.7 }}
                />
                <p className="text-[10px] text-white/20 mt-1">You can edit this before generating</p>
              </div>

              {/* Format picker */}
              <div>
                <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">
                  Format
                  {expanded.suggested_format && (
                    <span className="ml-2 normal-case" style={{ color: "#A78BFA" }}>← AI suggested {expanded.suggested_format}</span>
                  )}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {FORMATS.map((f) => (
                    <button key={f.value} onClick={() => setFormat(f.value)}
                      className="rounded-xl p-2.5 border text-left transition-all"
                      style={{
                        borderColor: format === f.value ? "#FF5C00" : "#2A2A3A",
                        background: format === f.value ? "rgba(255,92,0,0.08)" : "rgba(255,255,255,0.01)",
                      }}>
                      <div className="text-base mb-1">{f.icon}</div>
                      <div className="font-display text-xs font-bold text-white">{f.label}</div>
                      <div className="text-[10px] text-white/30">{f.slides}</div>
                    </button>
                  ))}
                </div>
              </div>

              {generateMutation.isError && (
                <div className="p-3 rounded-xl text-xs text-red-400 border border-red-900/40 bg-red-950/20">
                  ⚠ {generateMutation.error instanceof Error ? generateMutation.error.message : "Something went wrong."}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  disabled={stage === "generating"}
                  className="flex-1 py-3 rounded-xl text-sm font-medium border transition-all disabled:opacity-40"
                  style={{ borderColor: "#2A2A3A", color: "rgba(255,255,255,0.4)" }}>
                  ← Try different idea
                </button>
                <button
                  onClick={() => generateMutation.mutate()}
                  disabled={finalPrompt.trim().length < 10 || stage === "generating"}
                  className="flex-[2] py-3 rounded-xl font-display font-bold text-white text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg,#FF5C00,#6C2BD9)" }}>
                  {stage === "generating" ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Generating {format}…
                    </span>
                  ) : (
                    `Generate ${format === "carousel" ? "Carousel" : format === "post" ? "Post" : "Story"} →`
                  )}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Footer */}
      <p className="mt-8 text-xs text-white/15 relative z-10 text-center">
        AI Text: Groq · Gemini · Mistral &nbsp;·&nbsp; Images: Together AI · HuggingFace · Pollinations
      </p>
    </main>
  );
}

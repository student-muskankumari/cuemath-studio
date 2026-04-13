"use client";
import { useState } from "react";
import { Slide, SlideFormat, FontMood } from "@/types";

interface Props { slides: Slide[]; format: SlideFormat; palette: string[]; fontMood?: FontMood; }

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    // crossOrigin="anonymous" must match the <img crossOrigin="anonymous"> in
    // SlideCanvas/SlidePreview. Both use the same CORS mode so they share the
    // same browser cache entry — export reads from cache, no re-fetch, no
    // new Pollinations request, no black slide.
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => resolve(null), 25000);
    img.onload  = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = url;
  });
}

function getFonts(mood: FontMood = "bold"): { display: string; body: string; weight: number } {
  const map: Record<FontMood, { display: string; body: string; weight: number }> = {
    bold:    { display: "Syne", body: "DM Sans", weight: 800 },
    elegant: { display: "Playfair Display", body: "Lato", weight: 700 },
    playful: { display: "Nunito", body: "Nunito", weight: 800 },
    minimal: { display: "Space Grotesk", body: "Space Grotesk", weight: 600 },
  };
  return map[mood];
}

async function drawSlide(
  slide: Slide, palette: string[], index: number,
  format: SlideFormat, fontMood: FontMood = "bold"
): Promise<string> {
  const isStory = format === "story";
  const W = 1080;
  const H = isStory ? 1920 : 1080;

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Background
  ctx.fillStyle = "#0A0A0F";
  ctx.fillRect(0, 0, W, H);

  // Background image
  if (slide.imageUrl) {
    const img = await loadImage(slide.imageUrl);
    if (img) ctx.drawImage(img, 0, 0, W, H);
  }

  // Gradient overlay
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "rgba(0,0,0,0.1)");
  grad.addColorStop(0.4, "rgba(0,0,0,0.45)");
  grad.addColorStop(1, "rgba(0,0,0,0.9)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Accent bar top
  const accent = palette[index % palette.length] ?? "#FF5C00";
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, isStory ? 10 : 8);

  // Fonts
  const fonts = getFonts(fontMood);
  const headlineSize = isStory ? 80 : 72;
  const bodySize = isStory ? 42 : 38;
  const bottomPad = isStory ? 140 : 100;

  // Headline word-wrap
  ctx.fillStyle = "#ffffff";
  ctx.font = `${fonts.weight} ${headlineSize}px "${fonts.display}", sans-serif`;
  const maxW = W - 112;
  const words = slide.headline.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line + (line ? " " : "") + word;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);

  const lineH = headlineSize * 1.2;
  const totalTextH = lines.length * lineH + bodySize * 2 + 40;
  let y = H - bottomPad - totalTextH;

  lines.forEach(l => {
    ctx.fillStyle = "#ffffff";
    ctx.font = `${fonts.weight} ${headlineSize}px "${fonts.display}", sans-serif`;
    ctx.fillText(l, 56, y);
    y += lineH;
  });

  // Body text with word-wrap
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = `400 ${bodySize}px "${fonts.body}", sans-serif`;
  const bodyWords = slide.body.split(" ");
  const bodyLines: string[] = [];
  let bodyLine = "";
  for (const word of bodyWords) {
    const test = bodyLine + (bodyLine ? " " : "") + word;
    if (ctx.measureText(test).width > maxW && bodyLine) { bodyLines.push(bodyLine); bodyLine = word; }
    else bodyLine = test;
  }
  if (bodyLine) bodyLines.push(bodyLine);
  y += 20;
  bodyLines.slice(0, 3).forEach(l => {
    ctx.fillText(l, 56, y);
    y += bodySize * 1.3;
  });

  return canvas.toDataURL("image/jpeg", 0.93);
}

export default function ExportButton({ slides, format, palette, fontMood = "bold" }: Props) {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState("");
  const [copied, setCopied] = useState(false);

  const exportPDF = async () => {
    setExporting(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const isStory = format === "story";
      const W = 1080, H = isStory ? 1920 : 1080;
      const pdf = new jsPDF({
        orientation: isStory ? "portrait" : "landscape",
        unit: "px",
        format: [W, H],
      });

      for (let i = 0; i < slides.length; i++) {
        setProgress(`Rendering slide ${i + 1} / ${slides.length}…`);
        const imgData = await drawSlide(slides[i], palette, i, format, fontMood);
        if (i > 0) pdf.addPage([W, H], isStory ? "portrait" : "landscape");
        pdf.addImage(imgData, "JPEG", 0, 0, W, H);
      }

      setProgress("Saving…");
      pdf.save(`cuemath-${format}-${Date.now()}.pdf`);
    } catch (e) { console.error(e); alert("PDF export failed."); }
    finally { setExporting(false); setProgress(""); }
  };

  const exportZip = async () => {
    setExporting(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();

      for (let i = 0; i < slides.length; i++) {
        setProgress(`Rendering slide ${i + 1} / ${slides.length}…`);
        try {
          const imgData = await drawSlide(slides[i], palette, i, format, fontMood);
          zip.file(`slide-${i + 1}.jpg`, imgData.split(",")[1], { base64: true });
        } catch { /* skip */ }
      }

      if (!Object.keys(zip.files).length) { alert("Nothing to export."); return; }
      setProgress("Compressing…");
      const content = await zip.generateAsync({ type: "blob" });
      const a = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(content),
        download: `cuemath-${format}-images.zip`,
      });
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { console.error(e); }
    finally { setExporting(false); setProgress(""); }
  };

  return (
    <div className="flex items-center gap-2">
      {progress && <span className="text-xs text-white/40 animate-pulse">{progress}</span>}
      <button onClick={exportPDF} disabled={exporting}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50 transition-all"
        style={{ background: "linear-gradient(135deg,#FF5C00,#6C2BD9)" }}>
        {exporting ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "⬇"}
        PDF
      </button>
      <button onClick={exportZip} disabled={exporting}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium border text-white/50 hover:border-white/30 hover:text-white disabled:opacity-50 transition-all"
        style={{ borderColor: "#2A2A3A" }}>
        🗂 ZIP
      </button>
    </div>
  );
}

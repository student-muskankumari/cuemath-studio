export type SlideFormat = "post" | "story" | "carousel";
export type SlideTone = "hook" | "explain" | "example" | "cta";
export type FontMood = "bold" | "elegant" | "playful" | "minimal";

export interface PromptHistoryEntry {
  instruction: string;
  type: "text" | "image" | "both";
  timestamp: number;
}

export interface Slide {
  id: string;
  headline: string;
  body: string;
  visual_prompt: string;
  tone: SlideTone;
  imageUrl?: string;
  promptHistory?: PromptHistoryEntry[];
}

export interface Slidedeck {
  slides: Slide[];
  color_palette: string[];
  font_mood: FontMood;
  theme: string;
}

export interface GenerateRequest {
  prompt: string;
  format: SlideFormat;
}

export interface GenerateResponse {
  success: boolean;
  data?: Slidedeck;
  error?: string;
  provider?: string;
}

// Cuemath brand presets
export const BRAND_PALETTES: Record<string, { name: string; colors: string[]; label: string }> = {
  cuemath:   { name: "cuemath",   colors: ["#FF5C00", "#6C2BD9", "#FFFFFF"], label: "Cuemath Orange" },
  midnight:  { name: "midnight",  colors: ["#6366F1", "#8B5CF6", "#C4B5FD"], label: "Midnight Purple" },
  golden:    { name: "golden",    colors: ["#F59E0B", "#D97706", "#FEF3C7"], label: "Golden Hour" },
  teal:      { name: "teal",      colors: ["#0D9488", "#14B8A6", "#CCFBF1"], label: "Ocean Teal" },
  coral:     { name: "coral",     colors: ["#F43F5E", "#FB7185", "#FFE4E6"], label: "Coral Sunset" },
  forest:    { name: "forest",    colors: ["#16A34A", "#22C55E", "#DCFCE7"], label: "Forest Green" },
};

export const FONT_MOOD_MAP: Record<FontMood, { display: string; body: string; weight: string }> = {
  bold:     { display: "'Syne', sans-serif",        body: "'DM Sans', sans-serif",    weight: "800" },
  elegant:  { display: "'Playfair Display', serif", body: "'Lato', sans-serif",       weight: "700" },
  playful:  { display: "'Nunito', sans-serif",      body: "'Nunito', sans-serif",     weight: "800" },
  minimal:  { display: "'Space Grotesk', sans-serif", body: "'Space Grotesk', sans-serif", weight: "600" },
};

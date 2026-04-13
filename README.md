# Social Media Studio — Cuemath
Turn rough ideas into polished social media creatives instantly.

---

## QUICK START

### Step 1 — Install Node.js
Go to https://nodejs.org → Download LTS → Install → Restart terminal.

### Step 2 — Get API Keys (15 minutes, all free)

#### Text Generation Keys (pick at least Groq):
| Service | URL | Notes |
|---------|-----|-------|
| **Groq** (primary) | https://console.groq.com | Free, no credit card, fastest |
| Gemini (fallback) | https://aistudio.google.com | Free Google account |
| Mistral (backup) | https://console.mistral.ai | Free tier |

#### Image Generation Keys (pick at least one):
| Service | URL | Quality | Notes |
|---------|-----|---------|-------|
| **Together AI** ⭐ | https://together.ai | ★★★★★ | **Recommended** — Free $25 credit, FLUX.1-schnell |
| HuggingFace | https://huggingface.co | ★★★☆☆ | Free, slower (may time out) |

> **Together AI is strongly recommended** — it uses FLUX.1-schnell which has excellent semantic alignment (images actually match your slide content). Get key at together.ai → API Keys → Create.

### Step 3 — Set up the project

```bash
# 1. Unzip and open terminal in the project folder
cd social-media-studio

# 2. Copy env template
copy .env.example .env.local    # Windows
cp .env.example .env.local      # Mac/Linux

# 3. Edit .env.local — fill in your keys:
GROQ_API_KEY=gsk_your_key_here
GEMINI_API_KEY=AIza_your_key_here
TOGETHER_API_KEY=your_together_key_here     # ← Add this for best images
HUGGINGFACE_API_KEY=hf_your_key_here        # ← Optional fallback

# 4. Install and run
npm install
npm run dev
```

Open http://localhost:3000

---

## TROUBLESHOOTING IMAGES

**Images don't match the slide content:**
1. Add `TOGETHER_API_KEY` in `.env.local` — this is the best model for semantic accuracy
2. Visit http://localhost:3000/api/debug-image?prompt=YOUR+PROMPT to test image generation directly
3. Check your terminal for `[img]` log lines to see which provider is being used

**Images are slow to load:**
- Together AI: ~2-4 seconds ✓
- HuggingFace SDXL: ~15-30 seconds (model cold start)
- Pollinations: ~5-15 seconds

**Images show a loading spinner forever:**
- Check `.env.local` has valid keys
- Check terminal for error messages starting with `[img]`

---

## HOW IT WORKS

```
User types idea
      ↓
/api/generate → Groq (fast) → Gemini → Mistral (fallbacks)
      ↓
Returns JSON: headline + body + visual_prompt per slide
      ↓
/api/image-proxy → Together AI FLUX.1-schnell (best)
                 → HuggingFace SDXL-Turbo
                 → HuggingFace SDXL-base
                 → Pollinations flux-pro
                 → Pollinations flux
                 → Picsum (always works)
      ↓
Studio editor: Edit text | AI Text refine | AI Image refine
      ↓
Export as PDF or ZIP of images
```

---

## DEPLOY TO VERCEL

1. Push to GitHub
2. Go to vercel.com → Import repo
3. Add environment variables:
   - `GROQ_API_KEY`
   - `GEMINI_API_KEY`
   - `TOGETHER_API_KEY` ← important for images
   - `HUGGINGFACE_API_KEY`
   - `MISTRAL_API_KEY`
4. Deploy

---

## PROJECT STRUCTURE
```
app/
  page.tsx                    Landing page (format picker + prompt)
  studio/page.tsx             Slide editor (3-column layout)
  api/
    generate/route.ts         Generate full slidedeck via LLM
    regenerate/route.ts       Regenerate single slide
    refine-text/route.ts      AI text improvement with LLM
    refine-image/route.ts     AI image prompt evolution + regen
    image-proxy/route.ts      Image generation fallback chain
    debug-image/route.ts      Debug endpoint — test image gen
components/
  SlideCanvas.tsx             Slide thumbnail + full preview
  SlideEditor.tsx             3-tab editor (Edit | AI Text | Image)
  ExportButton.tsx            PDF + ZIP export
  Providers.tsx               TanStack Query setup
lib/
  ai.ts                       LLM calls + prompt engineering
types/
  index.ts                    TypeScript types
```

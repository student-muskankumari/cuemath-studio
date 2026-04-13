# Social Media Studio — Cuemath
Turn rough ideas into polished social media creatives instantly.

---

## QUICK START

### Step 1 — Install Node.js
Go to https://nodejs.org → Download LTS → Install → Restart terminal.

### Step 2 — Get API Keys (15 minutes, all free)

#### Text Generation (all 3 are free, no card needed):
| Service | URL | Notes |
|---------|-----|-------|
| **Groq** (primary) | https://console.groq.com | Fastest, no credit card |
| Gemini (fallback) | https://aistudio.google.com | Free Google account |
| Mistral (backup) | https://console.mistral.ai | Free tier |

#### Image Generation:
| Service | URL | Notes |
|---------|-----|-------|
| **Pollinations** ⭐ | https://pollinations.ai | Sign in with GitHub → API Key. Free pollen refills hourly |
| HuggingFace | https://huggingface.co | Settings → Access Tokens → New token (Read). Free, no card |

### Step 3 — Set up the project

```bash
# 1. Open terminal in the project folder
cd studio-final123

# 2. Copy env template
copy .env.example .env.local    # Windows
cp .env.example .env.local      # Mac/Linux

# 3. Edit .env.local and fill in your keys
GROQ_API_KEY=gsk_your_key_here
GEMINI_API_KEY=AIza_your_key_here
MISTRAL_API_KEY=your_key_here
POLLINATIONS_API_KEY=sk_your_key_here
HUGGINGFACE_TOKEN=hf_your_key_here

# 4. Install and run
npm install
npm run dev
```

Open http://localhost:3000

---

## TROUBLESHOOTING IMAGES

**Images show "failed to load":**
- Check terminal for `[img]` log lines to see which provider ran
- Visit http://localhost:3000/api/debug-image?prompt=test to test directly
- Make sure `POLLINATIONS_API_KEY` and `HUGGINGFACE_TOKEN` are set in `.env.local`

**Getting 429 rate-limit errors on Pollinations:**
- Your IP was rate-limited from heavy testing — wait 30-60 minutes
- Make sure `POLLINATIONS_API_KEY` is set — authenticated requests get per-account pollen with hourly refills instead of shared IP pool

**Image loads in studio but PDF export is black:**
- This is a CORS cache issue — fixed in current version
- Make sure you're using the latest `ExportButton.tsx` and `SlideCanvas.tsx`

---

## HOW IT WORKS

```
User types rough idea
        ↓
/api/expand-prompt → Groq → Gemini → Mistral (fallbacks)
        ↓
Returns structured creative brief + suggested format
        ↓
User reviews & edits → clicks Generate
        ↓
/api/generate → Groq → Gemini → Mistral (fallbacks)
        ↓
Returns JSON: headline + body + visual_prompt per slide
        ↓
/api/image-proxy (serialised queue, one slide at a time)
  1. HuggingFace FLUX.1-schnell  ← HUGGINGFACE_TOKEN
  2. Pollinations FLUX            ← POLLINATIONS_API_KEY
  3. Gradient fallback            ← always works
        ↓
Studio editor: Edit text | AI Text refine | AI Image refine
        ↓
Export as PDF or ZIP
```

---

## DEPLOY TO VERCEL

1. Push to GitHub (`.env.local` is gitignored — keys are never pushed)
2. Go to vercel.com → Import repo → Deploy
3. Settings → Environment Variables → add each key:

```
GROQ_API_KEY
GEMINI_API_KEY
MISTRAL_API_KEY
POLLINATIONS_API_KEY
HUGGINGFACE_TOKEN
```

4. Deployments → Redeploy (picks up the new env vars)

---

## PROJECT STRUCTURE

```
app/
  page.tsx                    Landing page (format picker + prompt input)
  studio/page.tsx             Slide editor (3-column layout)
  api/
    generate/route.ts         Generate full slidedeck via LLM
    expand-prompt/route.ts    Expand vague idea into creative brief
    regenerate/route.ts       Regenerate single slide
    refine-text/route.ts      AI text improvement per slide
    refine-image/route.ts     AI image prompt evolution + regeneration
    image-proxy/route.ts      Image generation with fallback chain
    debug-image/route.ts      Debug endpoint — test image generation

components/
  SlideCanvas.tsx             Slide thumbnail (left strip) + full preview (center)
  SlideEditor.tsx             3-tab editor: Edit | AI Text | Image
  ExportButton.tsx            Canvas-based PDF + ZIP export
  Providers.tsx               TanStack Query provider

lib/
  ai.ts                       LLM orchestration, prompt engineering, provider fallbacks

types/
  index.ts                    TypeScript types + brand palettes + font mood constants
```

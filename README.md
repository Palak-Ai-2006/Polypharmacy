# PolyPGx — Polypharmacy Pharmacogenomics Collision Engine

Detects dangerous multi-drug, multi-gene interactions using deterministic CYP enzyme collision detection + RAG-powered LLM clinical reasoning.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env and add your API keys
cp .env.example .env.local
# Edit .env.local with your ANTHROPIC_API_KEY

# 3. Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture (5 Layers)

```
User Input → CYP Collision Detector (deterministic) → RAG Retrieval → LLM Reasoning → Output
```

**Key insight:** The collision detector runs WITHOUT AI. The LLM reasons ON TOP of verified collision data.

## Project Structure

```
polypgx/
├── app/                        # Next.js 14 App Router
│   ├── page.tsx                # Main UI (replace with v0.dev)
│   ├── layout.tsx              # Root layout + SEO
│   ├── globals.css             # Base styles
│   └── api/
│       ├── analyze/route.ts    # POST /api/analyze — full pipeline
│       └── drugs/search/route.ts # GET /api/drugs/search?q= — autocomplete
├── lib/                        # Core logic
│   ├── types.ts                # Shared type definitions (THE CONTRACT)
│   ├── collision-detector.ts   # Layer 2: deterministic CYP collision detection
│   ├── phenoconversion.ts      # Phenoconversion logic
│   ├── rag-chain.ts            # Layer 3+4: RAG retrieval + Claude reasoning
│   ├── openfda.ts              # OpenFDA drug label API
│   └── rxnorm.ts               # RxNorm drug autocomplete API
├── data/
│   ├── cyp_database.json       # THE DATABASE — bio major's file (10 → 60 drugs)
│   └── README.md               # Instructions for bio major
└── components/                 # React components (add as needed)
```

## Who Does What

| Role | Files to Own |
|------|-------------|
| **CS #1** | `lib/collision-detector.ts`, `lib/rag-chain.ts`, `app/api/` |
| **CS #2** | `app/page.tsx` (v0.dev), `components/`, Vercel deploy |
| **BIO** | `data/cyp_database.json`, validate outputs, co-design system prompt |
| **AD** | UX review, pitch, demo scripts |

## API Contract

### `POST /api/analyze`
```json
{
  "patient": {
    "name": "Mrs. Chouhan",
    "age": 72,
    "drugs": ["warfarin", "fluconazole", "aspirin"],
    "geneticProfile": {
      "CYP3A4": "normal",
      "CYP2D6": "normal",
      "CYP2C19": "normal",
      "CYP2C9": "poor"
    }
  }
}
```

### `GET /api/drugs/search?q=war`
Returns: `[{ "rxcui": "...", "name": "warfarin" }]`

## Deploy
```bash
npm i -g vercel
vercel deploy
```

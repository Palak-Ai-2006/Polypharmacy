# PolyPGx

Detects dangerous multi-drug, multi-gene interactions using deterministic CYP enzyme collision detection combined with RAG-powered LLM clinical reasoning.

Built at HackPSU 2026.

## Quick Start

```bash
npm install --legacy-peer-deps
cp .env.example .env.local       # Add your GEMINI_API_KEY
npm run dev                       # Open http://localhost:3000
```

## Architecture

```
Drug Input + RxNorm > CYP Collision Engine > RAG + OpenFDA > Gemini Reasoning > Clinical UI
     Layer 1              Layer 2               Layer 3          Layer 4          Layer 5
```

Layers 1 through 3 are entirely deterministic. No AI. The LLM reasons on top of verified collision data.

## Project Structure

```
polypgx/
  app/
    page.tsx                  Thin orchestrator: SSE streaming, demo cases (~290 lines)
    layout.tsx                Root layout + SEO metadata
    error.tsx                 Global error boundary
    globals.css               Design tokens, print styles, animations
    api/
      analyze/route.ts        POST /api/analyze (SSE streaming endpoint)
      drugs/search/route.ts   GET  /api/drugs/search?q= (RxNorm autocomplete)
  components/
    app/
      AppHeader.tsx           Header bar with branding and navigation
      DrugSearchPanel.tsx     Drug search, medication list, primary physician
      PatientInfoSidebar.tsx  Demographics, clinical context, pharmacogenomics
      AnalysisResultsPanel.tsx Risk banner, enzyme activity, interactions (SSE aware)
      EnzymeActivityAccordion.tsx Per-enzyme collision display with role badges
      PhysicianNotesEditor.tsx Clinical notes with copy/print actions
    ui/                       Shadcn UI primitives (button, select, etc.)
  lib/
    store.ts                  Zustand centralized state store
    types.ts                  Shared TypeScript type contracts
    collision-detector.ts     Layer 2: Deterministic CYP collision detection
    phenoconversion.ts        Phenoconversion shift detection
    env-check.ts              Startup environment variable validation
    rag-chain.ts              Layer 4: LangChain + Gemini structured reasoning
    retriever.ts              Layer 3: ChromaDB vector retrieval
    openfda.ts                Layer 3: FDA drug safety label lookup
    rxnorm.ts                 Layer 1: RxNorm drug name normalization
    __tests__/
      collision-detector.test.ts  20 unit tests for deterministic collision logic
  data/
    cyp_database.json         Curated CYP enzyme interaction table
  scripts/
    ingest.ts                 RAG ingestion: builds ChromaDB collection
  vitest.config.ts            Test configuration with @ path alias
```

## API Contract

### POST /api/analyze (SSE Streaming)

**Request:**
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

**Response:** `Content-Type: text/event-stream`

| Event | Timing | Payload |
|-------|--------|---------|
| `collisions` | Instant (<5ms) | Deterministic CYP collision data, phenoconversions, unmatched drugs |
| `reasoning` | During LLM | Streaming reasoning text chunks |
| `analysis` | After LLM | Full result: summary, drug issues, recommendations, sources |
| `error` | On failure | Error message |
| `done` | End | Empty (stream complete) |

### GET /api/drugs/search?q=war

Returns: `[{ "rxcui": "...", "name": "warfarin" }]`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Free at [AI Studio](https://aistudio.google.com) |
| `CHROMA_URL` | No | ChromaDB endpoint (default: http://localhost:8000) |

## Prerequisites

- Node.js 18+
- npm 9+
- ChromaDB 0.4+ (optional, for RAG layer)

## Testing

```bash
npm test              # Run all 20 unit tests
npm run test:watch    # Watch mode for development
```

The test suite validates the deterministic CYP collision detector (Layer 2) across 7 categories: edge cases, substrate+inhibitor collisions, substrate+inducer collisions, polypharmacy scenarios, phenoconversion, risk calculations, and output structure.

## Documentation

Open [PolyPGx_Documentation.html](PolyPGx_Documentation.html) for the full project report. Open [FutureScope.html](FutureScope.html) for the development roadmap.

## Known Issues

`npm run build` may fail under Turbopack due to an upstream ESM/CJS conflict with `@chroma-core/default-embed`. The development server (`npm run dev`) works correctly. For production deployment, use Webpack mode.

Built for HackPSU 2026. All rights reserved.

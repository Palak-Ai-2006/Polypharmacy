// ============================================================
// PGx Report PDF Parser
// Extracts metabolizer phenotypes from clinical PGx reports
// using Google Gemini's multimodal capabilities.
// Supports: 23andMe, Tempus, OneOme, and generic reports.
// ============================================================

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { PGxReportResult, MetabolizerPhenotype } from "./types";

const EXTRACTION_PROMPT = `You are a pharmacogenomics data extraction engine.

You will receive the text content of a clinical PGx (pharmacogenomic) lab report.

Your job:
1. Identify the report source (23andMe, Tempus, OneOme, Invitae, Color, GeneSight, or "unknown").
2. Extract ALL CYP enzyme metabolizer phenotypes mentioned in the report.
3. Map each to one of: "poor", "intermediate", "normal", "rapid", "ultrarapid".
   - "Extensive" = "normal"
   - "Ultra-rapid" = "ultrarapid"
   - If the report says "*1/*2" or similar star alleles, interpret the phenotype.

Output ONLY valid JSON:
{
  "source": "23andMe",
  "phenotypes": {
    "CYP2D6": "poor",
    "CYP2C19": "normal",
    "CYP3A4": "normal"
  },
  "confidence": 0.95
}

If you cannot extract any phenotypes, return:
{ "source": "unknown", "phenotypes": {}, "confidence": 0 }`;

/**
 * Parse a PGx report PDF by extracting text and sending to Gemini.
 * Accepts either raw text or a base64-encoded PDF.
 */
export async function parsePGxReport(
  input: { text: string } | { pdfBase64: string; mimeType: string }
): Promise<PGxReportResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      source: "unknown",
      extractedPhenotypes: {},
      rawText: "",
      confidence: 0,
    };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  try {
    let response;

    if ("text" in input) {
      // Text-based parsing
      response = await model.generateContent([
        EXTRACTION_PROMPT,
        `\n\n--- REPORT TEXT ---\n${input.text}`,
      ]);
    } else {
      // PDF-based parsing (multimodal)
      response = await model.generateContent([
        EXTRACTION_PROMPT,
        {
          inlineData: {
            mimeType: input.mimeType,
            data: input.pdfBase64,
          },
        },
      ]);
    }

    const text = response.response.text();

    // Extract JSON from response
    const start = text.indexOf("{");
    let jsonStr: string | null = null;
    if (start !== -1) {
      let depth = 0;
      for (let i = start; i < text.length; i++) {
        if (text[i] === "{") depth++;
        else if (text[i] === "}") {
          if (--depth === 0) { jsonStr = text.slice(start, i + 1); break; }
        }
      }
    }

    if (!jsonStr) {
      return { source: "unknown", extractedPhenotypes: {}, rawText: text, confidence: 0 };
    }

    const parsed = JSON.parse(jsonStr);

    // Normalize phenotype values
    const extractedPhenotypes: Record<string, MetabolizerPhenotype> = {};
    for (const [enzyme, pheno] of Object.entries(parsed.phenotypes ?? {})) {
      const normalized = normalizePhenotype(String(pheno));
      if (normalized) {
        extractedPhenotypes[enzyme] = normalized;
      }
    }

    return {
      source: parsed.source ?? "unknown",
      extractedPhenotypes,
      rawText: "text" in input ? input.text.slice(0, 500) : "[PDF binary]",
      confidence: parsed.confidence ?? 0.5,
    };
  } catch (error) {
    console.error("PGx report parsing failed:", error);
    return {
      source: "unknown",
      extractedPhenotypes: {},
      rawText: "",
      confidence: 0,
    };
  }
}

function normalizePhenotype(value: string): MetabolizerPhenotype | null {
  const lower = value.toLowerCase().trim();
  if (lower === "poor") return "poor";
  if (lower === "intermediate") return "intermediate";
  if (lower === "normal" || lower === "extensive") return "normal";
  if (lower === "rapid") return "rapid";
  if (lower === "ultrarapid" || lower === "ultra-rapid") return "ultrarapid";
  return null;
}

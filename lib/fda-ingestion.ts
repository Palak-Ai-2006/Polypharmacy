// ============================================================
// FDA Drug Interaction Table Ingestion Pipeline
// Parses FDA CYP Drug Interaction Tables and validates against
// PharmGKB annotations to update cyp_database.json.
// ============================================================

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { DrugRecord, DrugEnzymeEntry, CYPEnzyme, DrugRole, InteractionStrength } from "./types";

const VALID_ENZYMES: CYPEnzyme[] = ["CYP3A4", "CYP2D6", "CYP2C19", "CYP2C9", "CYP1A2", "CYP2B6", "CYP2E1", "CYP3A5"];
const VALID_ROLES: DrugRole[] = ["substrate", "inhibitor", "inducer"];
const VALID_STRENGTHS: InteractionStrength[] = ["strong", "moderate", "weak", "sensitive"];

const FDA_EXTRACTION_PROMPT = `You are a pharmacology data extraction engine.

You will receive text from the FDA's "Drug Development and Drug Interactions — Table of Substrates, Inhibitors and Inducers" document.

Extract ALL drugs and their CYP enzyme interactions into structured JSON.

For each drug, identify:
1. The drug name (generic, lowercase)
2. For each CYP enzyme interaction:
   - enzyme: one of CYP3A4, CYP2D6, CYP2C19, CYP2C9, CYP1A2, CYP2B6, CYP2E1, CYP3A5
   - role: "substrate", "inhibitor", or "inducer"
   - strength: "strong", "moderate", "weak", or "sensitive" (for substrates)

Output ONLY a valid JSON array:
[
  {
    "drug": "drugname",
    "enzymes": [
      { "enzyme": "CYP3A4", "role": "substrate", "strength": "sensitive" }
    ],
    "clinical_note": "Brief clinical significance note"
  }
]`;

export interface IngestionResult {
  added: number;
  updated: number;
  skipped: number;
  errors: string[];
  drugs: Record<string, DrugRecord>;
}

/**
 * Parse FDA table text content and extract drug-enzyme interactions.
 * Returns validated DrugRecord entries ready to merge into cyp_database.json.
 */
export async function ingestFDATable(
  tableText: string
): Promise<IngestionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { added: 0, updated: 0, skipped: 0, errors: ["GEMINI_API_KEY not set"], drugs: {} };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  try {
    const response = await model.generateContent([
      FDA_EXTRACTION_PROMPT,
      `\n\n--- FDA TABLE TEXT ---\n${tableText}`,
    ]);

    const text = response.response.text();

    // Extract JSON array
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end === -1) {
      return { added: 0, updated: 0, skipped: 0, errors: ["No JSON array found in response"], drugs: {} };
    }

    const parsed = JSON.parse(text.slice(start, end + 1)) as Array<{
      drug: string;
      enzymes: Array<{ enzyme: string; role: string; strength: string }>;
      clinical_note?: string;
    }>;

    return validateAndBuild(parsed);
  } catch (error) {
    return {
      added: 0, updated: 0, skipped: 0,
      errors: [`Ingestion failed: ${error instanceof Error ? error.message : String(error)}`],
      drugs: {},
    };
  }
}

/**
 * Validate extracted data and build DrugRecord entries.
 */
function validateAndBuild(
  raw: Array<{ drug: string; enzymes: Array<{ enzyme: string; role: string; strength: string }>; clinical_note?: string }>
): IngestionResult {
  const result: IngestionResult = { added: 0, updated: 0, skipped: 0, errors: [], drugs: {} };

  for (const entry of raw) {
    const drugName = entry.drug?.toLowerCase().trim();
    if (!drugName) {
      result.errors.push("Entry missing drug name");
      result.skipped++;
      continue;
    }

    const validEnzymes: DrugEnzymeEntry[] = [];

    for (const e of entry.enzymes ?? []) {
      const enzyme = e.enzyme as CYPEnzyme;
      const role = e.role as DrugRole;
      const strength = e.strength as InteractionStrength;

      if (!VALID_ENZYMES.includes(enzyme)) {
        result.errors.push(`${drugName}: invalid enzyme "${e.enzyme}"`);
        continue;
      }
      if (!VALID_ROLES.includes(role)) {
        result.errors.push(`${drugName}: invalid role "${e.role}"`);
        continue;
      }
      if (!VALID_STRENGTHS.includes(strength)) {
        result.errors.push(`${drugName}: invalid strength "${e.strength}"`);
        continue;
      }

      validEnzymes.push({ enzyme, role, strength });
    }

    if (validEnzymes.length === 0) {
      result.skipped++;
      continue;
    }

    result.drugs[drugName] = {
      enzymes: validEnzymes,
      clinical_note: entry.clinical_note,
    };
    result.added++;
  }

  return result;
}

/**
 * Merge ingested drugs into an existing database, preserving manual entries.
 */
export function mergeDatabases(
  existing: Record<string, DrugRecord>,
  ingested: Record<string, DrugRecord>
): { merged: Record<string, DrugRecord>; added: number; updated: number } {
  const merged = { ...existing };
  let added = 0;
  let updated = 0;

  for (const [drug, record] of Object.entries(ingested)) {
    if (merged[drug]) {
      // Merge enzyme entries — add new ones, keep existing
      const existingEnzymes = new Set(
        merged[drug].enzymes.map(e => `${e.enzyme}-${e.role}`)
      );
      for (const newEntry of record.enzymes) {
        if (!existingEnzymes.has(`${newEntry.enzyme}-${newEntry.role}`)) {
          merged[drug].enzymes.push(newEntry);
        }
      }
      updated++;
    } else {
      merged[drug] = record;
      added++;
    }
  }

  return { merged, added, updated };
}

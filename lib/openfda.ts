// ============================================================
// OpenFDA Drug Label API (Free, No Key)
// Fetches real FDA data for drug warnings + interactions.
// ============================================================

import type { OpenFDADrugInfo } from "./types";

const BASE_URL = "https://api.fda.gov/drug/label.json";

/**
 * Fetch FDA label data for a drug (generic name).
 * Returns warnings, adverse reactions, and interactions.
 * Gracefully returns empty data on failure — never blocks the pipeline.
 */
export async function fetchOpenFDAData(drugName: string): Promise<OpenFDADrugInfo> {
  const empty: OpenFDADrugInfo = {
    drugName,
    warnings: [],
    adverseReactions: [],
    drugInteractions: [],
  };

  try {
    const url = `${BASE_URL}?search=openfda.generic_name:"${encodeURIComponent(drugName)}"&limit=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (!res.ok) return empty;

    const data = await res.json();
    const result = data.results?.[0];
    if (!result) return empty;

    return {
      drugName,
      warnings: truncateArray(result.warnings ?? [], 2),
      adverseReactions: truncateArray(result.adverse_reactions ?? [], 2),
      drugInteractions: truncateArray(result.drug_interactions ?? [], 2),
    };
  } catch {
    // Network error, timeout, etc. — never crash the pipeline.
    return empty;
  }
}

/**
 * Fetch OpenFDA data for multiple drugs in parallel.
 */
export async function fetchOpenFDABatch(drugs: string[]): Promise<OpenFDADrugInfo[]> {
  const results = await Promise.allSettled(
    drugs.map((d) => fetchOpenFDAData(d))
  );
  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { drugName: drugs[i], warnings: [], adverseReactions: [], drugInteractions: [] }
  );
}

/** Truncate long FDA text arrays to keep LLM context manageable */
function truncateArray(arr: string[], maxItems: number): string[] {
  return arr.slice(0, maxItems).map((s) => s.slice(0, 500));
}

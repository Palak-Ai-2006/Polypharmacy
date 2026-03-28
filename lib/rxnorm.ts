// ============================================================
// RxNorm API (Free, No Key) — Drug Name Autocomplete
// https://rxnav.nlm.nih.gov/REST/
// ============================================================

import type { RxNormSuggestion } from "./types";

const BASE_URL = "https://rxnav.nlm.nih.gov/REST";

/**
 * Search for drug names matching the query string.
 * Returns normalized drug names for the autocomplete dropdown.
 */
export async function searchDrugs(query: string): Promise<RxNormSuggestion[]> {
  if (!query || query.length < 2) return [];

  try {
    const url = `${BASE_URL}/drugs.json?name=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });

    if (!res.ok) return [];

    const data = await res.json();
    const concepts = data?.drugGroup?.conceptGroup ?? [];

    const suggestions: RxNormSuggestion[] = [];

    for (const group of concepts) {
      if (!group.conceptProperties) continue;
      for (const prop of group.conceptProperties) {
        suggestions.push({
          rxcui: prop.rxcui,
          name: prop.name.toLowerCase(),
        });
      }
    }

    // Deduplicate by name and limit to 10
    const seen = new Set<string>();
    return suggestions.filter((s) => {
      if (seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    }).slice(0, 10);
  } catch {
    return [];
  }
}

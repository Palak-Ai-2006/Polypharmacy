// ============================================================
// Phenoconversion Logic
// When a strong inhibitor shifts a patient's effective
// metabolizer status (e.g., Normal → Poor for CYP2D6).
// ============================================================

import type {
  CYPEnzyme,
  MetabolizerPhenotype,
  PatientInput,
  PhenoconversionEvent,
} from "./types";

const PHENOTYPE_ORDER: MetabolizerPhenotype[] = [
  "ultrarapid",
  "rapid",
  "normal",
  "intermediate",
  "poor",
];

/**
 * Checks if any strong inhibitor in the drug list should shift
 * the patient's effective phenotype for an enzyme.
 */
export function applyPhenoconversions(
  patient: PatientInput,
  enzymeMap: Record<CYPEnzyme, { substrates: string[]; inhibitors: string[]; inducers: string[] }>
): PhenoconversionEvent[] {
  const events: PhenoconversionEvent[] = [];
  const enzymes: CYPEnzyme[] = ["CYP3A4", "CYP2D6", "CYP2C19", "CYP2C9", "CYP1A2", "CYP2B6", "CYP2E1", "CYP3A5"];

  for (const enzyme of enzymes) {
    const inhibitors = enzymeMap[enzyme].inhibitors;
    const hasStrongInhibitor = inhibitors.some((i) => i.includes("strong"));
    const hasModerateInhibitor = inhibitors.some((i) => i.includes("moderate"));

    if (!hasStrongInhibitor && !hasModerateInhibitor) continue;

    const originalPhenotype = patient.geneticProfile[enzyme];
    if (!originalPhenotype || originalPhenotype === "unknown" || originalPhenotype === "poor") continue;

    // Strong inhibitor: shift down 2 levels (e.g., Normal → Poor)
    // Moderate inhibitor: shift down 1 level (e.g., Normal → Intermediate)
    const shiftAmount = hasStrongInhibitor ? 2 : 1;
    const currentIndex = PHENOTYPE_ORDER.indexOf(originalPhenotype);
    const newIndex = Math.min(currentIndex + shiftAmount, PHENOTYPE_ORDER.length - 1);
    const effectivePhenotype = PHENOTYPE_ORDER[newIndex];

    if (effectivePhenotype !== originalPhenotype) {
      const causedBy = inhibitors[0].replace(/ \(.*\)/, ""); // strip strength label

      events.push({
        enzyme,
        originalPhenotype,
        effectivePhenotype,
        causedBy,
        reason:
          `${causedBy} is a ${hasStrongInhibitor ? "strong" : "moderate"} ${enzyme} inhibitor, ` +
          `shifting effective phenotype from ${originalPhenotype} to ${effectivePhenotype} metabolizer.`,
      });
    }
  }

  return events;
}

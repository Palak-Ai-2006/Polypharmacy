// ============================================================
// Layer 2: CYP Collision Detector (DETERMINISTIC — NO AI)
// This is the backbone of the app. It runs BEFORE the LLM.
// Pure logic: drug list + CYP JSON → collision map.
// ============================================================

import cypDatabase from "@/data/cyp_database.json";
import { applyPhenoconversions } from "./phenoconversion";
import type {
  CYPDatabase,
  CYPEnzyme,
  PatientInput,
  CollisionMap,
  EnzymeCollision,
  RiskLevel,
} from "./types";

const ENZYMES: CYPEnzyme[] = ["CYP3A4", "CYP2D6", "CYP2C19", "CYP2C9"];
const db = cypDatabase as CYPDatabase;

/**
 * Main collision detection function.
 * Takes patient input, returns a collision map with risk levels.
 * This is 100% deterministic — no LLM, no network calls.
 */
export function detectCollisions(patient: PatientInput): CollisionMap {
  const unmatchedDrugs: string[] = [];

  // Step 1: Map each drug to its enzyme roles
  const enzymeMap: Record<CYPEnzyme, { substrates: string[]; inhibitors: string[]; inducers: string[] }> = {
    CYP3A4: { substrates: [], inhibitors: [], inducers: [] },
    CYP2D6: { substrates: [], inhibitors: [], inducers: [] },
    CYP2C19: { substrates: [], inhibitors: [], inducers: [] },
    CYP2C9: { substrates: [], inhibitors: [], inducers: [] },
  };

  for (const drugName of patient.drugs) {
    const key = drugName.toLowerCase().trim();
    const record = db[key];

    if (!record) {
      unmatchedDrugs.push(drugName);
      continue;
    }

    for (const entry of record.enzymes) {
      const enzyme = entry.enzyme as CYPEnzyme;
      if (!ENZYMES.includes(enzyme)) continue;

      const label = `${drugName}${entry.strength ? ` (${entry.strength})` : ""}`;

      if (entry.role === "substrate") enzymeMap[enzyme].substrates.push(label);
      if (entry.role === "inhibitor") enzymeMap[enzyme].inhibitors.push(label);
      if (entry.role === "inducer") enzymeMap[enzyme].inducers.push(label);
    }
  }

  // Step 2: Detect collisions per enzyme
  const collisions: EnzymeCollision[] = [];

  for (const enzyme of ENZYMES) {
    const { substrates, inhibitors, inducers } = enzymeMap[enzyme];
    const hasCollision =
      (substrates.length > 0 && inhibitors.length > 0) ||
      (substrates.length > 0 && inducers.length > 0) ||
      (substrates.length >= 3); // enzyme overload

    if (!hasCollision && substrates.length === 0 && inhibitors.length === 0 && inducers.length === 0) {
      continue; // skip enzymes with no activity
    }

    const riskLevel = calculateEnzymeRisk(substrates, inhibitors, inducers);
    const riskReason = buildRiskReason(enzyme, substrates, inhibitors, inducers);

    collisions.push({
      enzyme,
      substrates,
      inhibitors,
      inducers,
      riskLevel,
      riskReason,
    });
  }

  // Step 3: Apply phenoconversion
  const phenoconversions = applyPhenoconversions(patient, enzymeMap);

  // Step 4: Calculate overall risk
  const overallRisk = calculateOverallRisk(collisions, phenoconversions.length);

  return {
    collisions,
    overallRisk,
    phenoconversions,
    unmatchedDrugs,
  };
}

function calculateEnzymeRisk(
  substrates: string[],
  inhibitors: string[],
  inducers: string[]
): RiskLevel {
  // Strong inhibitor + substrate = CRITICAL
  if (inhibitors.some((i) => i.includes("strong")) && substrates.length > 0) {
    return "CRITICAL";
  }
  // Any inhibitor + substrate = HIGH
  if (inhibitors.length > 0 && substrates.length > 0) {
    return "HIGH";
  }
  // Inducer + substrate = HIGH (drug loses effectiveness)
  if (inducers.length > 0 && substrates.length > 0) {
    return "HIGH";
  }
  // 3+ substrates competing = MODERATE
  if (substrates.length >= 3) {
    return "MODERATE";
  }
  // 2 substrates = LOW
  if (substrates.length >= 2) {
    return "LOW";
  }
  return "NONE";
}

function calculateOverallRisk(collisions: EnzymeCollision[], phenoconversionCount: number): RiskLevel {
  const levels: RiskLevel[] = collisions.map((c) => c.riskLevel);
  if (levels.includes("CRITICAL") || (levels.includes("HIGH") && phenoconversionCount > 0)) {
    return "CRITICAL";
  }
  if (levels.includes("HIGH")) return "HIGH";
  if (levels.includes("MODERATE")) return "MODERATE";
  if (levels.includes("LOW")) return "LOW";
  return "NONE";
}

function buildRiskReason(
  enzyme: CYPEnzyme,
  substrates: string[],
  inhibitors: string[],
  inducers: string[]
): string {
  const parts: string[] = [];

  if (inhibitors.length > 0 && substrates.length > 0) {
    parts.push(
      `${inhibitors.join(", ")} inhibit${inhibitors.length === 1 ? "s" : ""} ${enzyme}, ` +
      `which is needed to metabolize ${substrates.join(", ")}. ` +
      `Risk: substrate accumulation / toxicity.`
    );
  }

  if (inducers.length > 0 && substrates.length > 0) {
    parts.push(
      `${inducers.join(", ")} induce${inducers.length === 1 ? "s" : ""} ${enzyme}, ` +
      `accelerating breakdown of ${substrates.join(", ")}. ` +
      `Risk: loss of therapeutic effect.`
    );
  }

  if (substrates.length >= 3) {
    parts.push(`${enzyme} is overloaded with ${substrates.length} competing substrates.`);
  }

  return parts.join(" ") || "No significant collision detected.";
}

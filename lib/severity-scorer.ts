// ============================================================
// Drug Interaction Severity Scorer
// Composite risk scoring model factoring:
//   1. Enzyme collision severity (40%)
//   2. Patient age (15%)
//   3. Hepatic function (15%)
//   4. Renal function (10%)
//   5. Pharmacogenomic risk (10%)
//   6. Drug count / polypharmacy load (10%)
// ============================================================

import type {
  CollisionMap,
  PatientInput,
  SeverityScore,
  SeverityFactor,
  RiskLevel,
} from "./types";

const RISK_SCORES: Record<RiskLevel, number> = {
  CRITICAL: 100,
  HIGH: 75,
  MODERATE: 50,
  LOW: 25,
  NONE: 0,
};

/**
 * Produces a weighted composite severity score (0-100) from collision data
 * and patient clinical context. Pure deterministic — no AI.
 */
export function calculateSeverityScore(
  patient: PatientInput,
  collisionMap: CollisionMap
): SeverityScore {
  const factors: SeverityFactor[] = [];

  // --- Factor 1: Enzyme Collision Severity (40%) ---
  const collisionScore = RISK_SCORES[collisionMap.overallRisk];
  factors.push({
    name: "Enzyme Collision Severity",
    weight: 0.40,
    value: collisionScore,
    weighted: 0.40 * collisionScore,
    detail: `Overall risk: ${collisionMap.overallRisk}. ${collisionMap.collisions.length} enzyme(s) involved, ${collisionMap.phenoconversions.length} phenoconversion(s).`,
  });

  // --- Factor 2: Patient Age (15%) ---
  const ageScore = calculateAgeRisk(patient.age);
  factors.push({
    name: "Patient Age",
    weight: 0.15,
    value: ageScore,
    weighted: 0.15 * ageScore,
    detail: patient.age
      ? `Age ${patient.age}: ${ageScore >= 60 ? "elevated" : "standard"} risk due to altered pharmacokinetics.`
      : "Age unknown — defaulting to moderate risk.",
  });

  // --- Factor 3: Hepatic Function (15%) ---
  const hepaticScore = calculateHepaticRisk(patient.hepaticFunction);
  factors.push({
    name: "Hepatic Function",
    weight: 0.15,
    value: hepaticScore,
    weighted: 0.15 * hepaticScore,
    detail: `Hepatic status: ${patient.hepaticFunction ?? "normal"}. CYP metabolism ${hepaticScore > 50 ? "significantly impaired" : "expected normal"}.`,
  });

  // --- Factor 4: Renal Function (10%) ---
  const renalScore = calculateRenalRisk(patient.renalFunction);
  factors.push({
    name: "Renal Function",
    weight: 0.10,
    value: renalScore,
    weighted: 0.10 * renalScore,
    detail: `Renal status: ${patient.renalFunction ?? "normal"}. Drug clearance ${renalScore > 50 ? "reduced" : "expected normal"}.`,
  });

  // --- Factor 5: Pharmacogenomic Risk (10%) ---
  const pgxScore = calculatePGxRisk(patient, collisionMap);
  factors.push({
    name: "Pharmacogenomic Risk",
    weight: 0.10,
    value: pgxScore,
    weighted: 0.10 * pgxScore,
    detail: `${collisionMap.phenoconversions.length} phenoconversion(s) detected. ${pgxScore >= 60 ? "Genetic profile amplifies collision risk." : "Genetic profile within expected range."}`,
  });

  // --- Factor 6: Polypharmacy Load (10%) ---
  const polyScore = calculatePolypharmacyRisk(patient.drugs.length);
  factors.push({
    name: "Polypharmacy Load",
    weight: 0.10,
    value: polyScore,
    weighted: 0.10 * polyScore,
    detail: `${patient.drugs.length} concurrent medications. ${polyScore >= 60 ? "High combinatorial interaction risk." : "Moderate medication count."}`,
  });

  // --- Composite ---
  const compositeScore = Math.round(
    factors.reduce((sum, f) => sum + f.weighted, 0)
  );
  const riskTier = scoreToTier(compositeScore);

  return {
    compositeScore,
    riskTier,
    factors,
    explanation: buildExplanation(compositeScore, riskTier, factors),
  };
}

function calculateAgeRisk(age?: number): number {
  if (!age) return 40; // unknown → moderate
  if (age >= 80) return 90;
  if (age >= 70) return 70;
  if (age >= 65) return 60;
  if (age >= 50) return 30;
  if (age <= 12) return 50; // pediatric
  return 10;
}

function calculateHepaticRisk(status?: string): number {
  switch (status) {
    case "child-c": return 100;
    case "child-b": return 75;
    case "child-a": return 50;
    default: return 5;
  }
}

function calculateRenalRisk(status?: string): number {
  switch (status) {
    case "severe": return 90;
    case "moderate": return 60;
    case "mild": return 30;
    default: return 5;
  }
}

function calculatePGxRisk(patient: PatientInput, collisionMap: CollisionMap): number {
  let score = 0;
  const profile = patient.geneticProfile;

  // Poor metabolizers on colliding enzymes = highest risk
  const collidingEnzymes = new Set(collisionMap.collisions.map(c => c.enzyme));
  for (const [enzyme, phenotype] of Object.entries(profile)) {
    if (!collidingEnzymes.has(enzyme as any)) continue;
    if (phenotype === "poor") score += 30;
    else if (phenotype === "ultrarapid") score += 20;
    else if (phenotype === "intermediate") score += 10;
  }

  // Phenoconversions stack
  score += collisionMap.phenoconversions.length * 15;

  return Math.min(score, 100);
}

function calculatePolypharmacyRisk(drugCount: number): number {
  if (drugCount >= 10) return 90;
  if (drugCount >= 7) return 70;
  if (drugCount >= 5) return 50;
  if (drugCount >= 3) return 30;
  return 10;
}

function scoreToTier(score: number): SeverityScore["riskTier"] {
  if (score >= 75) return "CRITICAL";
  if (score >= 55) return "HIGH";
  if (score >= 35) return "MODERATE";
  if (score >= 15) return "LOW";
  return "MINIMAL";
}

function buildExplanation(
  score: number,
  tier: string,
  factors: SeverityFactor[]
): string {
  const top = factors
    .sort((a, b) => b.weighted - a.weighted)
    .slice(0, 2)
    .map(f => f.name.toLowerCase());
  return `Composite severity score: ${score}/100 (${tier}). Primary drivers: ${top.join(" and ")}.`;
}

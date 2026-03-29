// ============================================================
// Clinical Decision Support Alerts
// Real-time alerting when new medications conflict with existing
// regimens. Fires alerts for CRITICAL and HIGH risk collisions.
// ============================================================

import { detectCollisions } from "./collision-detector";
import { calculateSeverityScore } from "./severity-scorer";
import type { PatientInput, CollisionMap, SeverityScore, RiskLevel, CYPEnzyme } from "./types";

// ---- Alert Types ----

export interface ClinicalAlert {
  id: string;
  timestamp: string;
  severity: "CRITICAL" | "HIGH" | "MODERATE";
  title: string;
  message: string;
  affectedDrug: string;
  conflictingDrugs: string[];
  enzyme: CYPEnzyme;
  mechanism: string;
  recommendation: string;
  acknowledged: boolean;
}

export interface AlertCheckResult {
  alerts: ClinicalAlert[];
  totalRisk: RiskLevel;
  severityScore: SeverityScore;
  requiresImmediateReview: boolean;
}

// ---- Alert Generation ----

/**
 * Check if adding a new drug to an existing regimen triggers alerts.
 * Returns alerts for any CRITICAL, HIGH, or MODERATE collisions.
 */
export function checkNewDrugAlerts(
  existingDrugs: string[],
  newDrug: string,
  patient: PatientInput
): AlertCheckResult {
  // Build patient with the new drug added
  const updatedPatient: PatientInput = {
    ...patient,
    drugs: [...existingDrugs, newDrug],
  };

  const collisionMap = detectCollisions(updatedPatient);
  const severityScore = calculateSeverityScore(updatedPatient, collisionMap);

  const alerts: ClinicalAlert[] = [];

  for (const collision of collisionMap.collisions) {
    if (collision.riskLevel === "NONE" || collision.riskLevel === "LOW") continue;

    // Only alert if the new drug is involved in this collision
    const newDrugInvolved =
      collision.substrates.some(s => s.toLowerCase().startsWith(newDrug.toLowerCase())) ||
      collision.inhibitors.some(i => i.toLowerCase().startsWith(newDrug.toLowerCase())) ||
      collision.inducers.some(i => i.toLowerCase().startsWith(newDrug.toLowerCase()));

    if (!newDrugInvolved) continue;

    const conflicting = [
      ...collision.substrates,
      ...collision.inhibitors,
      ...collision.inducers,
    ].filter(d => !d.toLowerCase().startsWith(newDrug.toLowerCase()));

    alerts.push({
      id: `alert-${Date.now()}-${collision.enzyme}`,
      timestamp: new Date().toISOString(),
      severity: collision.riskLevel as ClinicalAlert["severity"],
      title: buildAlertTitle(newDrug, collision.enzyme, collision.riskLevel),
      message: collision.riskReason,
      affectedDrug: newDrug,
      conflictingDrugs: conflicting.map(d => d.replace(/ \(.*\)/, "")),
      enzyme: collision.enzyme,
      mechanism: buildMechanism(newDrug, collision),
      recommendation: buildRecommendation(collision.riskLevel, newDrug, collision.enzyme),
      acknowledged: false,
    });
  }

  // Add phenoconversion alerts
  for (const pheno of collisionMap.phenoconversions) {
    alerts.push({
      id: `alert-${Date.now()}-pheno-${pheno.enzyme}`,
      timestamp: new Date().toISOString(),
      severity: "HIGH",
      title: `Phenoconversion: ${pheno.enzyme} ${pheno.originalPhenotype} → ${pheno.effectivePhenotype}`,
      message: pheno.reason,
      affectedDrug: pheno.causedBy,
      conflictingDrugs: [],
      enzyme: pheno.enzyme,
      mechanism: `Drug-induced phenoconversion shifts metabolizer status`,
      recommendation: `Review all ${pheno.enzyme} substrates in regimen. Consider dose adjustment or alternative therapy.`,
      acknowledged: false,
    });
  }

  // Sort by severity (CRITICAL first)
  const severityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MODERATE: 2 };
  alerts.sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

  return {
    alerts,
    totalRisk: collisionMap.overallRisk,
    severityScore,
    requiresImmediateReview: alerts.some(a => a.severity === "CRITICAL"),
  };
}

/**
 * Batch-check an entire medication list for all alerts.
 */
export function checkAllAlerts(patient: PatientInput): AlertCheckResult {
  const collisionMap = detectCollisions(patient);
  const severityScore = calculateSeverityScore(patient, collisionMap);

  const alerts: ClinicalAlert[] = [];

  for (const collision of collisionMap.collisions) {
    if (collision.riskLevel === "NONE" || collision.riskLevel === "LOW") continue;

    const primaryDrug = collision.substrates[0]?.replace(/ \(.*\)/, "") ?? "unknown";

    alerts.push({
      id: `alert-${Date.now()}-${collision.enzyme}`,
      timestamp: new Date().toISOString(),
      severity: collision.riskLevel as ClinicalAlert["severity"],
      title: `${collision.enzyme}: ${collision.riskLevel} risk collision`,
      message: collision.riskReason,
      affectedDrug: primaryDrug,
      conflictingDrugs: [...collision.inhibitors, ...collision.inducers].map(d => d.replace(/ \(.*\)/, "")),
      enzyme: collision.enzyme,
      mechanism: collision.riskReason,
      recommendation: buildRecommendation(collision.riskLevel, primaryDrug, collision.enzyme),
      acknowledged: false,
    });
  }

  const severityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MODERATE: 2 };
  alerts.sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

  return {
    alerts,
    totalRisk: collisionMap.overallRisk,
    severityScore,
    requiresImmediateReview: alerts.some(a => a.severity === "CRITICAL"),
  };
}

// ---- Webhook Dispatch ----

export interface WebhookConfig {
  url: string;
  secret?: string;
  severityThreshold: "CRITICAL" | "HIGH" | "MODERATE";
}

/**
 * Dispatch alerts to an external webhook (hospital notification system).
 */
export async function dispatchAlertWebhook(
  alert: ClinicalAlert,
  config: WebhookConfig
): Promise<boolean> {
  const severityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MODERATE: 2 };
  if ((severityOrder[alert.severity] ?? 3) > (severityOrder[config.severityThreshold] ?? 3)) {
    return false; // Below threshold
  }

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.secret) {
      headers["X-Webhook-Secret"] = config.secret;
    }

    const res = await fetch(config.url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        source: "PolyPGx",
        alert,
        timestamp: new Date().toISOString(),
      }),
    });

    return res.ok;
  } catch {
    console.error(`Webhook dispatch failed for alert ${alert.id}`);
    return false;
  }
}

// ---- Helpers ----

function buildAlertTitle(drug: string, enzyme: CYPEnzyme, risk: RiskLevel): string {
  return `${risk}: Adding ${drug} creates ${enzyme} collision`;
}

function buildMechanism(drug: string, collision: any): string {
  if (collision.inhibitors.length > 0 && collision.substrates.length > 0) {
    return `${drug} interacts at ${collision.enzyme} where ${collision.inhibitors.length} inhibitor(s) and ${collision.substrates.length} substrate(s) compete`;
  }
  if (collision.inducers.length > 0) {
    return `${drug} interacts at ${collision.enzyme} where induction accelerates substrate clearance`;
  }
  return `${collision.enzyme} overloaded with ${collision.substrates.length} competing substrates`;
}

function buildRecommendation(risk: RiskLevel, drug: string, enzyme: CYPEnzyme): string {
  if (risk === "CRITICAL") {
    return `STOP: Do not co-administer without pharmacist review. Consider alternative to ${drug} that avoids ${enzyme}.`;
  }
  if (risk === "HIGH") {
    return `CAUTION: Monitor closely. Consider dose reduction or therapeutic drug monitoring for ${enzyme} substrates.`;
  }
  return `MONITOR: Watch for signs of altered ${enzyme} metabolism. Schedule follow-up within 1 week.`;
}

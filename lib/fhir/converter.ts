// ============================================================
// FHIR R4 Resource Converter
// Maps PolyPGx internal types → HL7 FHIR R4 resources.
// Supports: MedicationRequest, Observation (genetic),
//           ClinicalImpression (interaction analysis).
// ============================================================

import type {
  PatientInput,
  CollisionMap,
  LLMAnalysisResult,
  FHIRMedicationRequest,
  FHIRObservation,
  FHIRClinicalImpression,
  FHIRCoding,
  CYPEnzyme,
  MetabolizerPhenotype,
} from "../types";

const LOINC_SYSTEM = "http://loinc.org";
const RXNORM_SYSTEM = "http://www.nlm.nih.gov/research/umls/rxnorm";
const PHARMGKB_SYSTEM = "https://www.pharmgkb.org";
const FHIR_CATEGORY_SYSTEM = "http://terminology.hl7.org/CodeSystem/observation-category";

// LOINC codes for CYP enzyme genotype observations
const CYP_LOINC: Record<string, string> = {
  CYP3A4: "94007-1",
  CYP2D6: "81247-9",
  CYP2C19: "79714-2",
  CYP2C9: "79713-4",
  CYP1A2: "94008-9",
  CYP2B6: "94009-7",
  CYP2E1: "94010-5",
  CYP3A5: "94011-3",
};

/**
 * Convert a patient's medication list to FHIR MedicationRequest resources.
 */
export function toMedicationRequests(
  patient: PatientInput,
  patientRef: string = "Patient/demo-001"
): FHIRMedicationRequest[] {
  return patient.drugs.map((drug, i) => ({
    resourceType: "MedicationRequest" as const,
    id: `medrx-${String(i + 1).padStart(3, "0")}`,
    status: "active" as const,
    intent: "order" as const,
    medicationCodeableConcept: {
      coding: [{ system: RXNORM_SYSTEM, code: "", display: drug }],
      text: drug,
    },
    subject: { reference: patientRef, display: patient.name },
    authoredOn: new Date().toISOString().split("T")[0],
  }));
}

/**
 * Convert a genetic profile to FHIR Observation resources (one per enzyme).
 */
export function toGeneticObservations(
  patient: PatientInput,
  patientRef: string = "Patient/demo-001"
): FHIRObservation[] {
  const observations: FHIRObservation[] = [];
  const entries = Object.entries(patient.geneticProfile) as [CYPEnzyme, MetabolizerPhenotype][];

  for (const [enzyme, phenotype] of entries) {
    if (phenotype === "unknown") continue;
    const loinc = CYP_LOINC[enzyme] ?? "00000-0";

    observations.push({
      resourceType: "Observation" as const,
      id: `obs-pgx-${enzyme.toLowerCase()}`,
      status: "final" as const,
      category: [{
        coding: [{
          system: FHIR_CATEGORY_SYSTEM,
          code: "laboratory",
          display: "Laboratory",
        }],
      }],
      code: {
        coding: [{ system: LOINC_SYSTEM, code: loinc, display: `${enzyme} Metabolizer Phenotype` }],
        text: `${enzyme} Metabolizer Phenotype`,
      },
      subject: { reference: patientRef, display: patient.name },
      valueCodeableConcept: {
        coding: [{
          system: PHARMGKB_SYSTEM,
          code: phenotype,
          display: `${phenotype} metabolizer`,
        }],
        text: `${phenotype} metabolizer`,
      },
    });
  }

  return observations;
}

/**
 * Convert collision analysis to a FHIR ClinicalImpression resource.
 */
export function toClinicalImpression(
  patient: PatientInput,
  collisionMap: CollisionMap,
  analysis?: LLMAnalysisResult,
  patientRef: string = "Patient/demo-001"
): FHIRClinicalImpression {
  const findings = collisionMap.collisions
    .filter(c => c.riskLevel !== "NONE")
    .map(c => ({
      itemCodeableConcept: {
        text: `${c.enzyme} ${c.riskLevel}: ${c.riskReason}`,
      },
    }));

  // Add phenoconversion findings
  for (const p of collisionMap.phenoconversions) {
    findings.push({
      itemCodeableConcept: {
        text: `Phenoconversion: ${p.enzyme} ${p.originalPhenotype} → ${p.effectivePhenotype} (caused by ${p.causedBy})`,
      },
    });
  }

  return {
    resourceType: "ClinicalImpression" as const,
    id: "ci-polypgx-001",
    status: "completed" as const,
    subject: { reference: patientRef, display: patient.name },
    date: new Date().toISOString(),
    summary: analysis?.summary ?? `PolyPGx detected ${findings.length} interaction(s). Overall risk: ${collisionMap.overallRisk}.`,
    finding: findings,
  };
}

/**
 * Bundle all FHIR resources for a patient analysis into a single object.
 */
export function toFHIRBundle(
  patient: PatientInput,
  collisionMap: CollisionMap,
  analysis?: LLMAnalysisResult
) {
  const patientRef = `Patient/${(patient.name ?? "unknown").replace(/\s+/g, "-").toLowerCase()}`;

  return {
    resourceType: "Bundle" as const,
    type: "collection" as const,
    timestamp: new Date().toISOString(),
    entry: [
      ...toMedicationRequests(patient, patientRef).map(r => ({ resource: r })),
      ...toGeneticObservations(patient, patientRef).map(r => ({ resource: r })),
      { resource: toClinicalImpression(patient, collisionMap, analysis, patientRef) },
    ],
  };
}

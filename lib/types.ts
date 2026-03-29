// ============================================================
// PolyPGx — Shared Type Definitions
// This file is the CONTRACT between all layers of the app.
// Every team member should understand these types.
// ============================================================

// --- INPUT TYPES (what the user provides) ---

export type MetabolizerPhenotype =
  | "poor"
  | "intermediate"
  | "normal"
  | "rapid"
  | "ultrarapid"
  | "unknown";

export type CYPEnzyme = "CYP3A4" | "CYP2D6" | "CYP2C19" | "CYP2C9" | "CYP1A2" | "CYP2B6" | "CYP2E1" | "CYP3A5";

export interface GeneticProfile {
  CYP3A4: MetabolizerPhenotype;
  CYP2D6: MetabolizerPhenotype;
  CYP2C19: MetabolizerPhenotype;
  CYP2C9: MetabolizerPhenotype;
  CYP1A2?: MetabolizerPhenotype;
  CYP2B6?: MetabolizerPhenotype;
  CYP2E1?: MetabolizerPhenotype;
  CYP3A5?: MetabolizerPhenotype;
}

export interface PatientInput {
  name?: string;
  age?: number;
  drugs: string[];           // list of drug names (generic)
  geneticProfile: GeneticProfile;
  renalFunction?: "normal" | "mild" | "moderate" | "severe";   // eGFR-based
  hepaticFunction?: "normal" | "child-a" | "child-b" | "child-c"; // Child-Pugh
  weight?: number;           // kg
  comorbidities?: string[];  // active diagnoses
}

// --- CYP DATABASE TYPES (what bio major builds) ---

export type DrugRole = "substrate" | "inhibitor" | "inducer";
export type InteractionStrength = "strong" | "moderate" | "weak" | "sensitive";

export interface DrugEnzymeEntry {
  enzyme: CYPEnzyme;
  role: DrugRole;
  strength: InteractionStrength;
}

export interface DrugRecord {
  enzymes: DrugEnzymeEntry[];
  clinical_note?: string;
}

// The full CYP database: { "warfarin": { enzymes: [...] }, ... }
export type CYPDatabase = Record<string, DrugRecord>;

// --- COLLISION DETECTOR OUTPUT (Layer 2 — deterministic) ---

export type RiskLevel = "CRITICAL" | "HIGH" | "MODERATE" | "LOW" | "NONE";

export interface EnzymeCollision {
  enzyme: CYPEnzyme;
  substrates: string[];     // drugs metabolized by this enzyme
  inhibitors: string[];     // drugs blocking this enzyme
  inducers: string[];       // drugs accelerating this enzyme
  riskLevel: RiskLevel;
  riskReason: string;       // human-readable explanation
}

export interface CollisionMap {
  collisions: EnzymeCollision[];
  overallRisk: RiskLevel;
  phenoconversions: PhenoconversionEvent[];
  unmatchedDrugs: string[]; // drugs not found in our database
}

export interface PhenoconversionEvent {
  enzyme: CYPEnzyme;
  originalPhenotype: MetabolizerPhenotype;
  effectivePhenotype: MetabolizerPhenotype;
  causedBy: string;         // which drug (inhibitor) caused the shift
  reason: string;
}

// --- RAG CONTEXT (Layer 3) ---

export interface RAGDocument {
  content: string;
  source: string;           // "PharmGKB", "CPIC", "OpenFDA"
  relevanceScore: number;
}

export interface RAGContext {
  documents: RAGDocument[];
  openFDAData: OpenFDADrugInfo[];
}

export interface OpenFDADrugInfo {
  drugName: string;
  warnings: string[];
  adverseReactions: string[];
  drugInteractions: string[];
}

// --- LLM OUTPUT (Layer 4) ---

export interface LLMAnalysisResult {
  overallRiskLevel: RiskLevel;
  summary: string;                    // 2-3 sentence executive summary
  bottleneckEnzymes: CYPEnzyme[];     // most overloaded enzymes
  drugIssues: DrugIssue[];            // per-drug breakdown
  clinicalNote: string;               // copy-pasteable Assessment+Plan note
  recommendations: string[];          // actionable suggestions
  sources: string[];                  // citations
  disclaimer: string;
}

export interface DrugIssue {
  drug: string;
  riskLevel: RiskLevel;
  issue: string;                      // what's wrong
  mechanism: string;                  // why (enzyme, phenotype)
  recommendation: string;            // what to do
}

// --- API REQUEST/RESPONSE (Layer 1 <-> Layer 5) ---

export interface AnalyzeRequest {
  patient: PatientInput;
}

export interface AnalyzeResponse {
  success: boolean;
  collisionMap: CollisionMap;         // deterministic layer output
  analysis: LLMAnalysisResult;        // LLM reasoning output
  timestamp: string;
  error?: string;
}

// --- RxNorm Autocomplete ---

export interface RxNormSuggestion {
  rxcui: string;
  name: string;
}

// --- Severity Scoring (composite risk) ---

export interface SeverityScore {
  compositeScore: number;       // 0-100
  riskTier: "CRITICAL" | "HIGH" | "MODERATE" | "LOW" | "MINIMAL";
  factors: SeverityFactor[];
  explanation: string;
}

export interface SeverityFactor {
  name: string;
  weight: number;              // 0-1
  value: number;               // raw score
  weighted: number;            // weight * value
  detail: string;
}

// --- FHIR R4 Resource Types ---

export interface FHIRMedicationRequest {
  resourceType: "MedicationRequest";
  id: string;
  status: "active" | "completed" | "cancelled";
  intent: "order" | "plan";
  medicationCodeableConcept: { coding: FHIRCoding[]; text: string };
  subject: FHIRReference;
  authoredOn: string;
}

export interface FHIRObservation {
  resourceType: "Observation";
  id: string;
  status: "final" | "preliminary";
  category: { coding: FHIRCoding[] }[];
  code: { coding: FHIRCoding[]; text: string };
  subject: FHIRReference;
  valueCodeableConcept?: { coding: FHIRCoding[]; text: string };
  component?: FHIRObservationComponent[];
}

export interface FHIRClinicalImpression {
  resourceType: "ClinicalImpression";
  id: string;
  status: "completed";
  subject: FHIRReference;
  date: string;
  summary: string;
  finding: { itemCodeableConcept: { text: string } }[];
}

export interface FHIRCoding {
  system: string;
  code: string;
  display: string;
}

export interface FHIRReference {
  reference: string;
  display?: string;
}

export interface FHIRObservationComponent {
  code: { coding: FHIRCoding[]; text: string };
  valueCodeableConcept: { coding: FHIRCoding[]; text: string };
}

// --- PGx Report Parsing ---

export interface PGxReportResult {
  source: string;            // "23andMe" | "Tempus" | "OneOme" | "unknown"
  extractedPhenotypes: Record<string, MetabolizerPhenotype>;
  rawText: string;
  confidence: number;        // 0-1
}

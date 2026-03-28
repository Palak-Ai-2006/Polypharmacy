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

export type CYPEnzyme = "CYP3A4" | "CYP2D6" | "CYP2C19" | "CYP2C9";

export interface GeneticProfile {
  CYP3A4: MetabolizerPhenotype;
  CYP2D6: MetabolizerPhenotype;
  CYP2C19: MetabolizerPhenotype;
  CYP2C9: MetabolizerPhenotype;
}

export interface PatientInput {
  name?: string;
  age?: number;
  drugs: string[];           // list of drug names (generic)
  geneticProfile: GeneticProfile;
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

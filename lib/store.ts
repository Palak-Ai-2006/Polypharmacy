import { create } from "zustand"
import type { RiskLevel } from "@/lib/types"

// ──────────────────────────────────────────────
// Shared UI types (previously inline in page.tsx)
// ──────────────────────────────────────────────

export interface Drug {
  rxcui: string
  name: string
}

export interface GeneticProfileUI {
  CYP3A4: string
  CYP2D6: string
  CYP2C19: string
  CYP2C9: string
}

export interface EnzymeData {
  enzyme: string
  substrates: string[]
  inhibitors: string[]
  inducers: string[]
  riskReason: string
  riskLevel: RiskLevel
  phenoconversion?: { from: string; to: string }
}

export interface DrugIssueUI {
  drug: string
  riskLevel: "CRITICAL" | "HIGH" | "MODERATE" | "LOW"
  issue: string
  mechanism: string
}

export interface AnalysisResult {
  overallRisk: RiskLevel
  summary: string
  enzymeActivity: EnzymeData[]
  drugIssues: DrugIssueUI[]
}

// ──────────────────────────────────────────────
// Store Shape
// ──────────────────────────────────────────────

interface PolyPGxState {
  // View
  view: "landing" | "analysis"
  setView: (v: "landing" | "analysis") => void

  // Landing
  landingName: string
  landingId: string
  setLandingName: (v: string) => void
  setLandingId: (v: string) => void

  // Provider (read-only display)
  providerName: string
  providerDept: string
  sessionStart: string

  // Patient demographics
  patientName: string
  patientId: string
  patientAge: string
  patientSex: string
  patientWeight: string
  patientHeight: string
  setPatientName: (v: string) => void
  setPatientId: (v: string) => void
  setPatientAge: (v: string) => void
  setPatientSex: (v: string) => void
  setPatientWeight: (v: string) => void
  setPatientHeight: (v: string) => void

  // Vitals
  patientBP: string
  patientHR: string
  patientTemp: string
  patientRR: string
  patientSpO2: string
  setPatientBP: (v: string) => void
  setPatientHR: (v: string) => void
  setPatientTemp: (v: string) => void
  setPatientRR: (v: string) => void
  setPatientSpO2: (v: string) => void

  // Clinical context
  allergies: string
  diagnosis: string
  alcohol: string
  tobacco: string
  liverFunction: string
  kidneyFunction: string
  setAllergies: (v: string) => void
  setDiagnosis: (v: string) => void
  setAlcohol: (v: string) => void
  setTobacco: (v: string) => void
  setLiverFunction: (v: string) => void
  setKidneyFunction: (v: string) => void

  // Genetic profile
  geneticProfile: GeneticProfileUI
  setGeneticProfile: (v: GeneticProfileUI) => void
  setEnzyme: (enzyme: keyof GeneticProfileUI, val: string) => void

  // Medications
  selectedDrugs: Drug[]
  addDrug: (d: Drug) => void
  removeDrug: (rxcui: string) => string | undefined
  setSelectedDrugs: (d: Drug[]) => void

  // Analysis state
  isAnalyzing: boolean
  analysisResult: AnalysisResult | null
  showAnalysis: boolean
  analysisError: string | null
  unmatchedDrugs: string[]
  aiSources: string[]
  aiRecommendations: string[]
  streamingReasoning: string
  collisionsReady: boolean
  rawCollisionMap: Record<string, unknown> | null
  ragContext: string | null
  setIsAnalyzing: (v: boolean) => void
  setAnalysisResult: (v: AnalysisResult | null) => void
  setShowAnalysis: (v: boolean) => void
  setAnalysisError: (v: string | null) => void
  setUnmatchedDrugs: (v: string[]) => void
  setAiSources: (v: string[]) => void
  setAiRecommendations: (v: string[]) => void
  setStreamingReasoning: (v: string) => void
  appendStreamingReasoning: (chunk: string) => void
  setCollisionsReady: (v: boolean) => void
  setRawCollisionMap: (v: Record<string, unknown> | null) => void
  setRagContext: (v: string | null) => void

  // Physician notes
  physicianNotes: string
  setPhysicianNotes: (v: string) => void
  copied: boolean
  setCopied: (v: boolean) => void

  // Primary doctor
  primaryDocName: string
  primaryDocSpecialty: string
  primaryDocHospital: string
  primaryDocPhone: string
  setPrimaryDocName: (v: string) => void
  setPrimaryDocSpecialty: (v: string) => void
  setPrimaryDocHospital: (v: string) => void
  setPrimaryDocPhone: (v: string) => void

  // Lab report
  reportUrl: string | null
  isParsing: boolean
  setReportUrl: (v: string | null) => void
  setIsParsing: (v: boolean) => void

  // Demo
  demoJustLoaded: boolean
  setDemoJustLoaded: (v: boolean) => void

  // Bulk reset for analysis
  resetAnalysis: () => void
}

// ──────────────────────────────────────────────
// Note Template
// ──────────────────────────────────────────────

const NOTE_TEMPLATE = `PHARMACOGENOMIC INTERACTION ASSESSMENT
===================================
Date:       ___/___/______
Provider:   _________________________
Patient:    _________________________

--- MEDICATION REVIEW ---------------
Current Regimen Assessed:  [ ] Yes  [ ] No
Interactions Identified:   [ ] Yes  [ ] No

--- CLINICAL DECISION ---------------
Action Taken:
[ ] No changes required
[ ] Dose adjustment: ___________________
[ ] Drug substitution: _________________
[ ] Additional monitoring ordered
[ ] Referral to specialist

Rationale:



--- PLAN & FOLLOW-UP ----------------
1.
2.
3.

Next Review Date: ___/___/______

------------------------------------
Signature: _________________________`

// ──────────────────────────────────────────────
// Store
// ──────────────────────────────────────────────

export const usePolyPGxStore = create<PolyPGxState>((set) => ({
  // View
  view: "landing",
  setView: (v) => set({ view: v }),

  // Landing
  landingName: "",
  landingId: "",
  setLandingName: (v) => set({ landingName: v }),
  setLandingId: (v) => set({ landingId: v }),

  // Provider
  providerName: "Dr. Aisha Patel",
  providerDept: "Internal Medicine",
  sessionStart: new Date().toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  }),

  // Patient demographics
  patientName: "", patientId: "", patientAge: "", patientSex: "",
  patientWeight: "", patientHeight: "",
  setPatientName: (v) => set({ patientName: v }),
  setPatientId: (v) => set({ patientId: v }),
  setPatientAge: (v) => set({ patientAge: v }),
  setPatientSex: (v) => set({ patientSex: v }),
  setPatientWeight: (v) => set({ patientWeight: v }),
  setPatientHeight: (v) => set({ patientHeight: v }),

  // Vitals
  patientBP: "", patientHR: "", patientTemp: "", patientRR: "", patientSpO2: "",
  setPatientBP: (v) => set({ patientBP: v }),
  setPatientHR: (v) => set({ patientHR: v }),
  setPatientTemp: (v) => set({ patientTemp: v }),
  setPatientRR: (v) => set({ patientRR: v }),
  setPatientSpO2: (v) => set({ patientSpO2: v }),

  // Clinical
  allergies: "", diagnosis: "", alcohol: "", tobacco: "",
  liverFunction: "", kidneyFunction: "",
  setAllergies: (v) => set({ allergies: v }),
  setDiagnosis: (v) => set({ diagnosis: v }),
  setAlcohol: (v) => set({ alcohol: v }),
  setTobacco: (v) => set({ tobacco: v }),
  setLiverFunction: (v) => set({ liverFunction: v }),
  setKidneyFunction: (v) => set({ kidneyFunction: v }),

  // Genetic profile
  geneticProfile: { CYP3A4: "Normal", CYP2D6: "Normal", CYP2C19: "Normal", CYP2C9: "Normal" },
  setGeneticProfile: (v) => set({ geneticProfile: v }),
  setEnzyme: (enzyme, val) =>
    set((s) => ({ geneticProfile: { ...s.geneticProfile, [enzyme]: val } })),

  // Medications
  selectedDrugs: [],
  addDrug: (d) => set((s) => ({ selectedDrugs: [...s.selectedDrugs, d] })),
  removeDrug: (rxcui) => {
    let removed: string | undefined
    set((s) => {
      const drug = s.selectedDrugs.find((d) => d.rxcui === rxcui)
      removed = drug?.name
      return { selectedDrugs: s.selectedDrugs.filter((d) => d.rxcui !== rxcui) }
    })
    return removed
  },
  setSelectedDrugs: (d) => set({ selectedDrugs: d }),

  // Analysis
  isAnalyzing: false,
  analysisResult: null,
  showAnalysis: false,
  analysisError: null,
  unmatchedDrugs: [],
  aiSources: [],
  aiRecommendations: [],
  streamingReasoning: "",
  collisionsReady: false,
  rawCollisionMap: null,
  ragContext: null,
  setIsAnalyzing: (v) => set({ isAnalyzing: v }),
  setAnalysisResult: (v) => set({ analysisResult: v }),
  setShowAnalysis: (v) => set({ showAnalysis: v }),
  setAnalysisError: (v) => set({ analysisError: v }),
  setUnmatchedDrugs: (v) => set({ unmatchedDrugs: v }),
  setAiSources: (v) => set({ aiSources: v }),
  setAiRecommendations: (v) => set({ aiRecommendations: v }),
  setStreamingReasoning: (v) => set({ streamingReasoning: v }),
  appendStreamingReasoning: (chunk) =>
    set((s) => ({ streamingReasoning: s.streamingReasoning + chunk })),
  setCollisionsReady: (v) => set({ collisionsReady: v }),
  setRawCollisionMap: (v) => set({ rawCollisionMap: v }),
  setRagContext: (v) => set({ ragContext: v }),

  // Physician notes
  physicianNotes: NOTE_TEMPLATE,
  setPhysicianNotes: (v) => set({ physicianNotes: v }),
  copied: false,
  setCopied: (v) => set({ copied: v }),

  // Primary doctor
  primaryDocName: "", primaryDocSpecialty: "", primaryDocHospital: "", primaryDocPhone: "",
  setPrimaryDocName: (v) => set({ primaryDocName: v }),
  setPrimaryDocSpecialty: (v) => set({ primaryDocSpecialty: v }),
  setPrimaryDocHospital: (v) => set({ primaryDocHospital: v }),
  setPrimaryDocPhone: (v) => set({ primaryDocPhone: v }),

  // Lab report
  reportUrl: null,
  isParsing: false,
  setReportUrl: (v) => set({ reportUrl: v }),
  setIsParsing: (v) => set({ isParsing: v }),

  // Demo
  demoJustLoaded: false,
  setDemoJustLoaded: (v) => set({ demoJustLoaded: v }),

  // Bulk reset
  resetAnalysis: () =>
    set({
      showAnalysis: false,
      analysisResult: null,
      analysisError: null,
      unmatchedDrugs: [],
      aiSources: [],
      aiRecommendations: [],
      streamingReasoning: "",
      collisionsReady: false,
      rawCollisionMap: null,
      ragContext: null,
    }),
}))

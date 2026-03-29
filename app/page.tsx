"use client"

import { useEffect, useCallback } from "react"
import { User, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"

import { usePolyPGxStore } from "@/lib/store"
import { AppHeader } from "@/components/app/AppHeader"
import { DrugSearchPanel } from "@/components/app/DrugSearchPanel"
import { PatientInfoSidebar } from "@/components/app/PatientInfoSidebar"
import { AnalysisResultsPanel } from "@/components/app/AnalysisResultsPanel"
import { PhysicianNotesEditor } from "@/components/app/PhysicianNotesEditor"

// ──────────────────────────────────────────────
// Demo Case Data
// ──────────────────────────────────────────────

const DEMOS = [
  {
    label: "CRITICAL",
    description: "Warfarin + Fluconazole",
    scenario: "CYP2C9 Intermediate Metabolizer: bleeding risk",
    reportPath: "/reports/patient-demo-1.pdf",
    patient: {
      name: "Margaret Chen", id: "MRN-00142", age: "72", sex: "female",
      weight: "58", height: "162", allergies: "Penicillin",
      diagnosis: "Atrial fibrillation, Candida infection",
      alcohol: "none", tobacco: "former", liver: "normal", kidney: "mild",
    },
    vitals: { bp: "138/86", hr: "72", temp: "37.1", rr: "16", spo2: "97" },
    primaryDoc: { name: "Dr. Helen Foster", specialty: "Cardiology", hospital: "St. Mary's Medical Center", phone: "(617) 555-0142" },
    drugs: [
      { rxcui: "1", name: "Warfarin" },
      { rxcui: "33", name: "Fluconazole" },
      { rxcui: "3", name: "Omeprazole" },
      { rxcui: "2", name: "Clopidogrel" },
    ],
    fallbackProfile: { CYP3A4: "Intermediate", CYP2D6: "Poor", CYP2C19: "Rapid", CYP2C9: "Intermediate" },
  },
  {
    label: "HIGH",
    description: "Codeine + Paroxetine",
    scenario: "CYP2D6 Poor Metabolizer: opioid toxicity risk",
    reportPath: "/reports/patient-demo-2.pdf",
    patient: {
      name: "James Wilson", id: "MRN-00289", age: "45", sex: "male",
      weight: "82", height: "178", allergies: "None known",
      diagnosis: "Chronic back pain, Major depressive disorder",
      alcohol: "occasional", tobacco: "never", liver: "normal", kidney: "normal",
    },
    vitals: { bp: "124/78", hr: "68", temp: "36.8", rr: "14", spo2: "99" },
    primaryDoc: { name: "Dr. Marcus Webb", specialty: "Pain Management", hospital: "Riverside Community Hospital", phone: "(312) 555-0289" },
    drugs: [
      { rxcui: "16", name: "Codeine" },
      { rxcui: "20", name: "Paroxetine" },
      { rxcui: "15", name: "Metoprolol" },
    ],
    fallbackProfile: { CYP3A4: "Normal", CYP2D6: "Poor", CYP2C19: "Normal", CYP2C9: "Normal" },
  },
  {
    label: "CRITICAL",
    description: "Clopidogrel + Omeprazole",
    scenario: "CYP2C19 Poor Metabolizer: antiplatelet failure",
    reportPath: "/reports/patient-demo-3.pdf",
    patient: {
      name: "Robert Park", id: "MRN-00371", age: "65", sex: "male",
      weight: "88", height: "175", allergies: "Aspirin (GI intolerance)",
      diagnosis: "Post-MI antiplatelet therapy, GERD",
      alcohol: "none", tobacco: "former", liver: "normal", kidney: "mild",
    },
    vitals: { bp: "142/90", hr: "76", temp: "37.0", rr: "15", spo2: "96" },
    primaryDoc: { name: "Dr. Sunita Rao", specialty: "Interventional Cardiology", hospital: "Northwest Heart Institute", phone: "(503) 555-0371" },
    drugs: [
      { rxcui: "2", name: "Clopidogrel" },
      { rxcui: "3", name: "Omeprazole" },
      { rxcui: "32", name: "Voriconazole" },
    ],
    fallbackProfile: { CYP3A4: "Normal", CYP2D6: "Intermediate", CYP2C19: "Poor", CYP2C9: "Normal" },
  },
  {
    label: "HIGH",
    description: "Tamoxifen + Paroxetine",
    scenario: "CYP2D6 Poor Metabolizer: reduced cancer efficacy",
    reportPath: "/reports/patient-demo-4.pdf",
    patient: {
      name: "Sarah Mitchell", id: "MRN-00458", age: "52", sex: "female",
      weight: "67", height: "165", allergies: "Sulfa drugs",
      diagnosis: "ER+ Breast cancer, Depression",
      alcohol: "none", tobacco: "never", liver: "normal", kidney: "normal",
    },
    vitals: { bp: "118/74", hr: "70", temp: "36.9", rr: "14", spo2: "98" },
    primaryDoc: { name: "Dr. Patricia Lim", specialty: "Oncology", hospital: "Cedar Valley Cancer Center", phone: "(415) 555-0458" },
    drugs: [
      { rxcui: "30", name: "Tamoxifen" },
      { rxcui: "20", name: "Paroxetine" },
      { rxcui: "24", name: "Venlafaxine" },
    ],
    fallbackProfile: { CYP3A4: "Normal", CYP2D6: "Poor", CYP2C19: "Normal", CYP2C9: "Normal" },
  },
]

// ──────────────────────────────────────────────
// SSE Analysis Hook
// ──────────────────────────────────────────────

function useSSEAnalysis() {
  const store = usePolyPGxStore()

  return useCallback(async () => {
    const { selectedDrugs, patientName, patientAge, geneticProfile } = store

    if (selectedDrugs.length === 0) return

    store.setIsAnalyzing(true)
    store.setShowAnalysis(false)
    store.setAnalysisError(null)
    store.setUnmatchedDrugs([])
    store.setStreamingReasoning("")
    store.setCollisionsReady(false)

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient: {
            name: patientName,
            age: patientAge ? parseInt(patientAge) : undefined,
            drugs: selectedDrugs.map((d) => d.name),
            geneticProfile,
          },
        }),
      })

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error("No response stream")

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        let eventType = ""
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim()
          } else if (line.startsWith("data: ") && eventType) {
            try {
              const data = JSON.parse(line.slice(6))
              handleSSEEvent(eventType, data, store)
            } catch {
              // skip malformed JSON
            }
            eventType = ""
          }
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "An unexpected error occurred"
      store.setAnalysisError(msg)
      toast.error(`Analysis failed: ${msg}`)
    } finally {
      store.setIsAnalyzing(false)
    }
  }, [store])
}

function handleSSEEvent(
  event: string,
  data: Record<string, unknown>,
  s: ReturnType<typeof usePolyPGxStore.getState>,
) {

  switch (event) {
    case "collisions": {
      const collisions = data.collisions as Array<{
        enzyme: string; substrates: string[]; inhibitors: string[];
        inducers: string[]; riskReason: string; riskLevel: string;
      }>
      const phenoconversions = data.phenoconversions as Array<{
        enzyme: string; from: string; to: string;
      }>

      if ((data.unmatchedDrugs as string[])?.length > 0) {
        s.setUnmatchedDrugs(data.unmatchedDrugs as string[])
      }

      s.setRawCollisionMap({
        collisions: data.collisions,
        phenoconversions: data.phenoconversions,
        overallRisk: data.overallRisk,
        unmatchedDrugs: data.unmatchedDrugs,
        severityScore: data.severityScore,
      })

      s.setAnalysisResult({
        overallRisk: (data.overallRisk as string) as "CRITICAL" | "HIGH" | "MODERATE" | "LOW" | "NONE",
        summary: "",
        enzymeActivity: collisions.map((c) => ({
          enzyme: c.enzyme,
          substrates: c.substrates ?? [],
          inhibitors: c.inhibitors ?? [],
          inducers: c.inducers ?? [],
          riskReason: c.riskReason ?? "",
          riskLevel: c.riskLevel as "CRITICAL" | "HIGH" | "MODERATE" | "LOW" | "NONE",
          phenoconversion: phenoconversions?.find((p) => p.enzyme === c.enzyme),
        })),
        drugIssues: [],
      })
      s.setCollisionsReady(true)
      break
    }

    case "reasoning": {
      s.setStreamingReasoning(data.chunk as string)
      break
    }

    case "analysis": {
      // Read current store state — s is a stale snapshot and won't have the
      // enzymeActivity that was written by the earlier "collisions" event.
      const current = usePolyPGxStore.getState().analysisResult
      s.setAnalysisResult({
        overallRisk: (data.overallRiskLevel as string) as "CRITICAL" | "HIGH" | "MODERATE" | "LOW" | "NONE"
          || current?.overallRisk || "NONE",
        summary: (data.summary as string) || "No significant interactions detected.",
        enzymeActivity: current?.enzymeActivity || [],
        drugIssues: (data.drugIssues as Array<{
          drug: string; riskLevel: string; issue: string; mechanism: string;
        }>)?.map((i) => ({
          drug: i.drug,
          riskLevel: i.riskLevel as "CRITICAL" | "HIGH" | "MODERATE" | "LOW",
          issue: i.issue,
          mechanism: i.mechanism,
        })) || [],
      })
      s.setAiSources((data.sources as string[]) ?? [])
      s.setAiRecommendations((data.recommendations as string[]) ?? [])
      s.setRagContext((data.ragContext as string | null) ?? null)

      s.setShowAnalysis(true)
      s.setStreamingReasoning("")
      toast.success("Analysis complete")
      break
    }

    case "error": {
      s.setAnalysisError((data.error as string) || "Unknown error")
      toast.error(`Analysis failed: ${data.error}`)
      break
    }
  }
}

// ──────────────────────────────────────────────
// Page Component (Thin Orchestrator)
// ──────────────────────────────────────────────

export default function PolyPGxPage() {
  const store = usePolyPGxStore()
  const analyzeInteractions = useSSEAnalysis()

  // Auto-trigger analysis when a demo case is loaded
  useEffect(() => {
    if (store.demoJustLoaded && store.selectedDrugs.length > 0) {
      store.setDemoJustLoaded(false)
      analyzeInteractions()
    }
  }, [store.demoJustLoaded, store.selectedDrugs, analyzeInteractions, store])

  const loadDemo = useCallback((demo: typeof DEMOS[number]) => {
    store.setPatientName(demo.patient.name)
    store.setPatientId(demo.patient.id)
    store.setPatientAge(demo.patient.age)
    store.setPatientSex(demo.patient.sex)
    store.setPatientWeight(demo.patient.weight)
    store.setPatientHeight(demo.patient.height)
    store.setAllergies(demo.patient.allergies)
    store.setDiagnosis(demo.patient.diagnosis)
    store.setAlcohol(demo.patient.alcohol)
    store.setTobacco(demo.patient.tobacco)
    store.setLiverFunction(demo.patient.liver)
    store.setKidneyFunction(demo.patient.kidney)
    store.setPatientBP(demo.vitals.bp)
    store.setPatientHR(demo.vitals.hr)
    store.setPatientTemp(demo.vitals.temp)
    store.setPatientRR(demo.vitals.rr)
    store.setPatientSpO2(demo.vitals.spo2)
    store.setPrimaryDocName(demo.primaryDoc.name)
    store.setPrimaryDocSpecialty(demo.primaryDoc.specialty)
    store.setPrimaryDocHospital(demo.primaryDoc.hospital)
    store.setPrimaryDocPhone(demo.primaryDoc.phone)
    store.setSelectedDrugs(demo.drugs)
    store.setGeneticProfile(demo.fallbackProfile)
    store.setReportUrl(demo.reportPath)
    store.resetAnalysis()
    store.setView("analysis")
    store.setDemoJustLoaded(true)
  }, [store])

  const handleBack = useCallback(() => store.setView("landing"), [store])

  // ── Landing View ──
  if (store.view === "landing") {
    return (
      <TooltipProvider>
        <div className="h-screen bg-[#F4F1EB] flex flex-col">
          <AppHeader />
          <main className="flex-1 flex flex-col items-center justify-center gap-8 px-6 overflow-y-auto py-8">
            {/* New patient card */}
            <div className="bg-white border border-[#E8E4DC] rounded-lg p-6 w-full max-w-md shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <User className="h-4 w-4 text-[#5A6B7A]" />
                <h2 className="text-sm font-semibold text-[#12354E]">Open Patient Chart</h2>
              </div>
              <div className="flex flex-col gap-2">
                <input
                  type="text" value={store.landingName}
                  onChange={(e) => store.setLandingName(e.target.value)}
                  placeholder="Patient Name"
                  className="h-9 text-sm text-[#12354E] bg-[#F4F1EB] border border-[#E8E4DC] rounded-md outline-none focus:border-[#064F6E] px-3"
                />
                <input
                  type="text" value={store.landingId}
                  onChange={(e) => store.setLandingId(e.target.value)}
                  placeholder="MRN / Patient ID"
                  className="h-9 text-sm text-[#12354E] bg-[#F4F1EB] border border-[#E8E4DC] rounded-md outline-none focus:border-[#064F6E] px-3"
                />
                <button
                  onClick={() => {
                    store.setPatientName(store.landingName)
                    store.setPatientId(store.landingId)
                    store.setView("analysis")
                  }}
                  className="mt-1 h-9 bg-[#064F6E] text-white text-sm font-medium rounded-md hover:bg-[#12354E] transition-colors"
                >
                  Open Chart &rarr;
                </button>
              </div>
            </div>

            {/* Demo cases */}
            <div className="w-full max-w-2xl">
              <p className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium mb-3">
                Or load a demo case
              </p>
              <div className="grid grid-cols-2 gap-3">
                {DEMOS.map((demo) => (
                  <button
                    key={demo.patient.id}
                    onClick={() => loadDemo(demo)}
                    className="bg-white border border-[#E8E4DC] rounded-lg p-4 text-left hover:border-[#064F6E] hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        demo.label === "CRITICAL" ? "bg-[#C0392B] text-white" : "bg-[#E67E22] text-white"
                      }`}>
                        {demo.label}
                      </span>
                      <span className="text-[10px] text-[#5A6B7A]">{demo.patient.id}</span>
                    </div>
                    <div className="text-sm font-semibold text-[#12354E] group-hover:text-[#064F6E]">
                      {demo.patient.name}
                    </div>
                    <div className="text-[10px] text-[#5A6B7A] mt-0.5">
                      {demo.patient.age}{demo.patient.sex === "female" ? "F" : "M"} &middot; {demo.patient.diagnosis.split(",")[0]}
                    </div>
                    <div className="text-xs text-[#12354E] mt-2 font-medium">{demo.description}</div>
                    <div className="text-[10px] text-[#5A6B7A] mt-0.5">{demo.scenario}</div>
                  </button>
                ))}
              </div>
            </div>
          </main>
        </div>
      </TooltipProvider>
    )
  }

  // ── Analysis View ──
  return (
    <TooltipProvider>
      <div className="h-screen overflow-hidden bg-[#FDFBF7] flex flex-col">
        <AppHeader showBack onBack={handleBack} />

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Drug Search Panel */}
          <DrugSearchPanel />

          {/* Right Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Patient Info */}
            <PatientInfoSidebar />

            {/* Action Bar */}
            <div className="h-10 min-h-10 bg-[#F4F1EB] border-b border-[#E8E4DC] px-4 flex items-center justify-between">
              <span className="text-xs text-[#5A6B7A]">
                Ready to analyze {store.selectedDrugs.length} medication(s) against genetic profile
              </span>
              <Button
                onClick={analyzeInteractions}
                disabled={store.selectedDrugs.length === 0 || store.isAnalyzing}
                className="h-8 px-6 text-sm font-medium bg-[#064F6E] text-white rounded-md hover:shadow-[0_0_12px_rgba(167,212,228,0.4)] disabled:opacity-40"
              >
                {store.isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  "Analyze Interactions"
                )}
              </Button>
            </div>

            {/* Bottom: Analysis + Notes (58/42 split) */}
            <div className="flex-1 flex gap-3 p-3 overflow-hidden">
              <AnalysisResultsPanel />
              <PhysicianNotesEditor />
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

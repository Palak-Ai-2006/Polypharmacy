"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { toast } from "sonner"
import {
  Dna,
  Search,
  X,
  AlertTriangle,
  User,
  Heart,
  FlaskConical,
  Stethoscope,
  CircleUser,
  ClipboardCopy,
  Check,
  Info,
  Loader2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Types
interface Drug {
  rxcui: string
  name: string
}

interface GeneticProfile {
  CYP3A4: string
  CYP2D6: string
  CYP2C19: string
  CYP2C9: string
}

interface EnzymeData {
  enzyme: string
  substrates: string[]
  inhibitors: string[]
  inducers: string[]
  riskReason: string
  riskLevel: "CRITICAL" | "HIGH" | "MODERATE" | "LOW" | "NONE"
  phenoconversion?: { from: string; to: string }
}

interface DrugIssue {
  drug: string
  riskLevel: "CRITICAL" | "HIGH" | "MODERATE" | "LOW"
  issue: string
  mechanism: string
}

interface AnalysisResult {
  overallRisk: "CRITICAL" | "HIGH" | "MODERATE" | "LOW" | "NONE"
  summary: string
  enzymeActivity: EnzymeData[]
  drugIssues: DrugIssue[]
  unmatchedDrugs?: string[]
  rawCollisionMap?: unknown
  ragContext?: string | null
}

// Risk colors
const riskColors = {
  CRITICAL: { bg: "bg-[#C0392B]", text: "text-white", border: "border-l-[#C0392B]", light: "bg-[#C0392B]/5" },
  HIGH: { bg: "bg-[#E67E22]", text: "text-white", border: "border-l-[#E67E22]", light: "bg-[#E67E22]/5" },
  MODERATE: { bg: "bg-[#F99D1B]", text: "text-[#12354E]", border: "border-l-[#F99D1B]", light: "bg-[#F99D1B]/5" },
  LOW: { bg: "bg-[#27AE60]", text: "text-white", border: "border-l-[#27AE60]", light: "bg-[#27AE60]/5" },
  NONE: { bg: "bg-[#A7D4E4]", text: "text-[#12354E]", border: "border-l-[#A7D4E4]", light: "bg-[#A7D4E4]/5" },
}

const RISK_ORDER = { CRITICAL: 0, HIGH: 1, MODERATE: 2, LOW: 3 } as const

const DEMOS = [
  {
    label: "CRITICAL",
    description: "Warfarin + Fluconazole",
    scenario: "CYP2C9 Intermediate Metabolizer — bleeding risk",
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
    scenario: "CYP2D6 Poor Metabolizer — opioid toxicity risk",
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
    scenario: "CYP2C19 Poor Metabolizer — antiplatelet failure",
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
    scenario: "CYP2D6 Poor Metabolizer — reduced cancer efficacy",
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

const enzymeColors: Record<string, string> = {
  CYP3A4: "#064F6E",
  CYP2D6: "#F99D1B",
  CYP2C19: "#27AE60",
  CYP2C9: "#E67E22",
}


export default function PolyPGxPage() {
  // Provider state
  const [providerName] = useState("Dr. Aisha Patel")
  const [providerDept] = useState("Internal Medicine")
  const [sessionStart] = useState(() =>
    new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })
  )

  // View state
  const [view, setView] = useState<"landing" | "analysis">("landing")
  const [landingName, setLandingName] = useState("")
  const [landingId, setLandingId] = useState("")

  // Patient state
  const [patientName, setPatientName] = useState("")
  const [patientId, setPatientId] = useState("")
  const [patientAge, setPatientAge] = useState("")
  const [patientSex, setPatientSex] = useState("")
  const [patientWeight, setPatientWeight] = useState("")
  const [patientHeight, setPatientHeight] = useState("")

  // Vitals
  const [patientBP, setPatientBP] = useState("")
  const [patientHR, setPatientHR] = useState("")
  const [patientTemp, setPatientTemp] = useState("")
  const [patientRR, setPatientRR] = useState("")
  const [patientSpO2, setPatientSpO2] = useState("")

  // Clinical context (display only)
  const [allergies, setAllergies] = useState("")
  const [diagnosis, setDiagnosis] = useState("")
  const [alcohol, setAlcohol] = useState("")
  const [tobacco, setTobacco] = useState("")
  const [liverFunction, setLiverFunction] = useState("")
  const [kidneyFunction, setKidneyFunction] = useState("")

  // Genetic profile
  const [geneticProfile, setGeneticProfile] = useState<GeneticProfile>({
    CYP3A4: "Normal",
    CYP2D6: "Normal",
    CYP2C19: "Normal",
    CYP2C9: "Normal",
  })

  // Medications
  const [drugSearch, setDrugSearch] = useState("")
  const [searchResults, setSearchResults] = useState<Drug[]>([])
  const [selectedDrugs, setSelectedDrugs] = useState<Drug[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [addedDrug, setAddedDrug] = useState<string | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  // Analysis
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [showAnalysis, setShowAnalysis] = useState(false)

  // Physician notes
  const [medReviewAssessed, setMedReviewAssessed] = useState(false)
  const [medReviewInteractions, setMedReviewInteractions] = useState(false)
  const [clinicalNoChanges, setClinicalNoChanges] = useState(false)
  const [clinicalDoseAdjust, setClinicalDoseAdjust] = useState(false)
  const [clinicalDoseAdjustNote, setClinicalDoseAdjustNote] = useState("")
  const [clinicalDrugSub, setClinicalDrugSub] = useState(false)
  const [clinicalDrugSubNote, setClinicalDrugSubNote] = useState("")
  const [clinicalMonitoring, setClinicalMonitoring] = useState(false)
  const [clinicalReferral, setClinicalReferral] = useState(false)
  const [clinicalRationale, setClinicalRationale] = useState("")
  const [planItem1, setPlanItem1] = useState("")
  const [planItem2, setPlanItem2] = useState("")
  const [planItem3, setPlanItem3] = useState("")
  const [followUpDay, setFollowUpDay] = useState("")
  const [followUpMonth, setFollowUpMonth] = useState("")
  const [followUpYear, setFollowUpYear] = useState("")
  const [earlyVisitNote, setEarlyVisitNote] = useState("")
  const [noteSavedAt, setNoteSavedAt] = useState<string | null>(null)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [submitDocId, setSubmitDocId] = useState("")
  const [submitDocPassword, setSubmitDocPassword] = useState("")
  const [noteSubmitted, setNoteSubmitted] = useState(false)
  const [noteSubmittedAt, setNoteSubmittedAt] = useState("")
  const [copied, setCopied] = useState(false)
  const [currentTimestamp, setCurrentTimestamp] = useState("")

  // Primary doctor
  const [primaryDocName, setPrimaryDocName] = useState("")
  const [primaryDocSpecialty, setPrimaryDocSpecialty] = useState("")
  const [primaryDocHospital, setPrimaryDocHospital] = useState("")
  const [primaryDocPhone, setPrimaryDocPhone] = useState("")

  // Lab DNA report
  const [reportUrl, setReportUrl] = useState<string | null>(null)
  const [isParsing, setIsParsing] = useState(false)

  // Set timestamp on client only to avoid hydration mismatch
  useEffect(() => {
    setCurrentTimestamp(
      new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    )
  }, [])

  // Drug search with debounce
  useEffect(() => {
    if (drugSearch.length < 2) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await fetch(`/api/drugs/search?q=${encodeURIComponent(drugSearch)}`)
        const data = await res.json()
        setSearchResults(data.filter((d: Drug) => !selectedDrugs.some((s) => s.rxcui === d.rxcui)))
        setShowDropdown(true)
      } catch {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [drugSearch, selectedDrugs])

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const addDrug = (drug: Drug) => {
    setSelectedDrugs((prev) => [...prev, drug])
    setAddedDrug(drug.rxcui)
    setTimeout(() => setAddedDrug(null), 150)
    setDrugSearch("")
    setShowDropdown(false)
  }

  const removeDrug = (rxcui: string) => {
    setSelectedDrugs((prev) => prev.filter((d) => d.rxcui !== rxcui))
  }

  const loadDemo = (demo: typeof DEMOS[number]) => {
    setPatientName(demo.patient.name)
    setPatientId(demo.patient.id)
    setPatientAge(demo.patient.age)
    setPatientSex(demo.patient.sex)
    setPatientWeight(demo.patient.weight)
    setPatientHeight(demo.patient.height)
    setAllergies(demo.patient.allergies)
    setDiagnosis(demo.patient.diagnosis)
    setAlcohol(demo.patient.alcohol)
    setTobacco(demo.patient.tobacco)
    setLiverFunction(demo.patient.liver)
    setKidneyFunction(demo.patient.kidney)
    setPatientBP(demo.vitals.bp)
    setPatientHR(demo.vitals.hr)
    setPatientTemp(demo.vitals.temp)
    setPatientRR(demo.vitals.rr)
    setPatientSpO2(demo.vitals.spo2)
    setPrimaryDocName(demo.primaryDoc.name)
    setPrimaryDocSpecialty(demo.primaryDoc.specialty)
    setPrimaryDocHospital(demo.primaryDoc.hospital)
    setPrimaryDocPhone(demo.primaryDoc.phone)
    setSelectedDrugs(demo.drugs)
    setGeneticProfile(demo.fallbackProfile)
    setReportUrl(demo.reportPath)
    setShowAnalysis(false)
    setAnalysisResult(null)
    setView("analysis")
    setTimeout(() => analyzeInteractions(), 100)
  }

  const analyzeInteractions = async () => {
    if (selectedDrugs.length === 0) return

    setIsAnalyzing(true)
    setShowAnalysis(false)

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
      const data = await res.json()
      setAnalysisResult({
        overallRisk: data.collisionMap?.overallRisk || data.analysis?.overallRiskLevel || "NONE",
        summary: data.analysis?.summary || "No significant interactions detected.",
        enzymeActivity:
          data.collisionMap?.collisions?.map(
            (c: {
              enzyme: string
              substrates: string[]
              inhibitors: string[]
              inducers: string[]
              riskReason: string
              riskLevel: "CRITICAL" | "HIGH" | "MODERATE" | "LOW" | "NONE"
            }) => ({
              enzyme: c.enzyme,
              substrates: c.substrates ?? [],
              inhibitors: c.inhibitors ?? [],
              inducers: c.inducers ?? [],
              riskReason: c.riskReason ?? "",
              riskLevel: c.riskLevel,
              phenoconversion: data.collisionMap?.phenoconversions?.find(
                (p: { enzyme: string }) => p.enzyme === c.enzyme
              ),
            })
          ) || [],
        drugIssues:
          data.analysis?.drugIssues?.map(
            (issue: { drug: string; riskLevel: "CRITICAL" | "HIGH" | "MODERATE" | "LOW"; issue: string; mechanism: string }) => ({
              drug: issue.drug,
              riskLevel: issue.riskLevel,
              issue: issue.issue,
              mechanism: issue.mechanism,
            })
          ) || [],
        unmatchedDrugs: data.collisionMap?.unmatchedDrugs ?? [],
        rawCollisionMap: data.collisionMap,
        ragContext: data.ragContext,
      })
      setShowAnalysis(true)
    } catch {
      toast.error("Analysis failed. Please try again.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const copyNotes = async () => {
    const followUpDate = followUpDay && followUpMonth && followUpYear
      ? `${followUpDay} ${followUpMonth} ${followUpYear}`
      : "Not specified"
    const actions = [
      clinicalNoChanges && "No changes required",
      clinicalDoseAdjust && `Dose adjustment: ${clinicalDoseAdjustNote}`,
      clinicalDrugSub && `Drug substitution: ${clinicalDrugSubNote}`,
      clinicalMonitoring && "Additional monitoring ordered",
      clinicalReferral && "Referral to specialist",
    ].filter(Boolean).join("\n")
    const text = [
      "PHARMACOGENOMIC INTERACTION ASSESSMENT",
      noteSubmittedAt ? `Submitted: ${noteSubmittedAt}` : noteSavedAt ? `Saved: ${noteSavedAt}` : "",
      "",
      "MEDICATION REVIEW",
      `Current Regimen Assessed: ${medReviewAssessed ? "Yes" : "No"}`,
      `Interactions Identified: ${medReviewInteractions ? "Yes" : "No"}`,
      "",
      "CLINICAL DECISION",
      actions || "None selected",
      "",
      `Rationale: ${clinicalRationale || "—"}`,
      "",
      "PLAN & FOLLOW-UP",
      `1. ${planItem1 || "—"}`,
      `2. ${planItem2 || "—"}`,
      `3. ${planItem3 || "—"}`,
      "",
      `Next Review Date: ${followUpDate}`,
      earlyVisitNote ? `Early visit conditions: ${earlyVisitNote}` : "",
    ].filter(l => l !== undefined).join("\n")
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleSaveNote = () => {
    const ts = new Date().toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    })
    setNoteSavedAt(ts)
  }

  const handleSubmitNote = () => {
    if (!submitDocId || !submitDocPassword) return
    const ts = new Date().toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    })
    setNoteSubmittedAt(ts)
    setNoteSubmitted(true)
    setShowSubmitModal(false)
    setSubmitDocId("")
    setSubmitDocPassword("")
  }

  const sortedDrugIssues = useMemo(() => {
    if (!analysisResult?.drugIssues) return []
    return [...analysisResult.drugIssues].sort((a, b) => RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel])
  }, [analysisResult?.drugIssues])

  // Shared header
  const Header = ({ showBack }: { showBack?: boolean }) => (
    <header className="h-10 min-h-10 bg-white border-b border-[#E8E4DC] flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-2">
        <Dna className="h-5 w-5 text-[#064F6E]" />
        <span className="text-lg font-bold text-[#12354E]">PolyPGx</span>
        <span className="text-[#E8E4DC]">·</span>
        <span className="text-xs text-[#5A6B7A]">Clinical Interaction Analyzer</span>
        {showBack && (
          <>
            <span className="text-[#E8E4DC] ml-2">·</span>
            <button
              onClick={() => setView("landing")}
              className="text-xs text-[#5A6B7A] hover:text-[#064F6E] ml-1"
            >
              ← Patients
            </button>
          </>
        )}
      </div>
      <div className="border-l border-[#E8E4DC] pl-3">
        <span className="text-[10px] uppercase tracking-[0.2em] text-[#5A6B7A] font-medium">
          FOR RESEARCH USE ONLY
        </span>
      </div>
    </header>
  )

  // Landing view
  if (view === "landing") return (
    <TooltipProvider>
      <div className="h-screen bg-[#F4F1EB] flex flex-col">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center gap-8 px-6 overflow-y-auto py-8">
          {/* New patient card */}
          <div className="bg-white border border-[#E8E4DC] rounded-lg p-6 w-full max-w-md shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-4 w-4 text-[#5A6B7A]" />
              <h2 className="text-sm font-semibold text-[#12354E]">Open Patient Chart</h2>
            </div>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={landingName}
                onChange={(e) => setLandingName(e.target.value)}
                placeholder="Patient Name"
                className="h-9 text-sm text-[#12354E] bg-[#F4F1EB] border border-[#E8E4DC] rounded-md outline-none focus:border-[#064F6E] px-3"
              />
              <input
                type="text"
                value={landingId}
                onChange={(e) => setLandingId(e.target.value)}
                placeholder="MRN / Patient ID"
                className="h-9 text-sm text-[#12354E] bg-[#F4F1EB] border border-[#E8E4DC] rounded-md outline-none focus:border-[#064F6E] px-3"
              />
              <button
                onClick={() => {
                  setPatientName(landingName)
                  setPatientId(landingId)
                  setView("analysis")
                }}
                className="mt-1 h-9 bg-[#064F6E] text-white text-sm font-medium rounded-md hover:bg-[#12354E] transition-colors"
              >
                Open Chart →
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
                      demo.label === "CRITICAL"
                        ? "bg-[#C0392B] text-white"
                        : "bg-[#E67E22] text-white"
                    }`}>
                      {demo.label}
                    </span>
                    <span className="text-[10px] text-[#5A6B7A]">{demo.patient.id}</span>
                  </div>
                  <div className="text-sm font-semibold text-[#12354E] group-hover:text-[#064F6E]">
                    {demo.patient.name}
                  </div>
                  <div className="text-[10px] text-[#5A6B7A] mt-0.5">
                    {demo.patient.age}{demo.patient.sex === "female" ? "F" : "M"} · {demo.patient.diagnosis.split(",")[0]}
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

  return (
    <TooltipProvider>
      <div className="h-screen overflow-hidden bg-[#FDFBF7] flex flex-col">
        <Header showBack />

        {/* Main content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Column - 260px */}
          <div className="w-[260px] min-w-[260px] border-r border-[#E8E4DC] flex flex-col bg-white">
            {/* Medications section - fills available space */}
            <div className="flex-1 flex flex-col p-3 overflow-hidden">
              {/* Title row */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[#12354E]">Medications</span>
                {selectedDrugs.length > 0 && (
                  <span className="w-5 h-5 rounded-full bg-[#064F6E] text-white text-[10px] flex items-center justify-center">
                    {selectedDrugs.length}
                  </span>
                )}
              </div>

              {/* Search input */}
              <div className="relative mt-2" ref={searchRef}>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#5A6B7A]" />
                  <Input
                    value={drugSearch}
                    onChange={(e) => setDrugSearch(e.target.value)}
                    placeholder="Search drugs..."
                    className="h-8 text-sm pl-7 pr-8 border-[#E8E4DC] rounded-md focus:ring-[#064F6E] focus:border-[#064F6E]"
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#5A6B7A] animate-spin" />
                  )}
                </div>

                {/* Autocomplete dropdown */}
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-[#E8E4DC] rounded-md shadow-lg max-h-36 overflow-y-auto">
                    {searchResults.map((drug) => (
                      <button
                        key={drug.rxcui}
                        onClick={() => addDrug(drug)}
                        className="w-full px-2.5 py-1.5 text-left text-sm text-[#12354E] hover:bg-[#F4F1EB] cursor-pointer"
                      >
                        {drug.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Drug table */}
              <div className="flex-1 mt-2 overflow-y-auto scrollbar-hide">
                {selectedDrugs.length === 0 ? (
                  <div className="text-xs text-[#5A6B7A] text-center py-4">No medications added</div>
                ) : (
                  <div className="flex flex-col">
                    {selectedDrugs.map((drug, i) => (
                      <div
                        key={drug.rxcui}
                        className={`flex items-center gap-2 py-1.5 px-1 rounded ${
                          addedDrug === drug.rxcui ? "animate-scale-in" : ""
                        } hover:bg-[#F4F1EB] group`}
                      >
                        <span className="text-[10px] text-[#5A6B7A] w-4 text-right shrink-0">{i + 1}.</span>
                        <span className="flex-1 text-sm font-medium text-[#12354E] leading-tight">{drug.name}</span>
                        <button
                          onClick={() => removeDrug(drug.rxcui)}
                          className="opacity-0 group-hover:opacity-100 text-[#5A6B7A] hover:text-[#C0392B] shrink-0"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer + Primary Doctor */}
              <div className="mt-auto">
                <div className="border-t border-[#E8E4DC] pt-2">
                  <span className="text-[10px] text-[#5A6B7A] px-1">{selectedDrugs.length} medication(s)</span>
                </div>

                {primaryDocName && (
                  <div className="border-t border-[#E8E4DC] mt-2 pt-2 px-1">
                    <div className="flex items-center gap-1 mb-1.5">
                      <Stethoscope className="h-3 w-3 text-[#5A6B7A]" />
                      <span className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium">Primary Physician</span>
                    </div>
                    <div className="text-sm font-semibold text-[#12354E] leading-tight">{primaryDocName}</div>
                    <div className="text-xs text-[#5A6B7A] mt-0.5">{primaryDocSpecialty}</div>
                    <div className="text-[10px] text-[#5A6B7A] mt-0.5 leading-tight">{primaryDocHospital}</div>
                    <div className="text-[10px] text-[#064F6E] mt-0.5">{primaryDocPhone}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Session Indicator */}
            <div className="bg-[#F4F1EB] px-3 py-2.5 flex items-start gap-2.5 border-t border-[#E8E4DC]">
              <div className="w-8 h-8 rounded-full bg-white border border-[#E8E4DC] flex items-center justify-center shrink-0 mt-0.5">
                <CircleUser className="w-5 h-5 text-[#064F6E]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[#12354E] leading-tight">{providerName}</div>
                <div className="text-[10px] text-[#5A6B7A] mt-0.5">{providerDept}</div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#27AE60] shrink-0" />
                  <span className="text-[10px] text-[#5A6B7A]">Active · {sessionStart}</span>
                </div>
              </div>
              <button className="text-[10px] text-[#5A6B7A] underline cursor-pointer shrink-0 mt-0.5">Sign Out</button>
            </div>
          </div>

          {/* Right Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Patient Profile - ~200px fixed */}
            <div className="bg-white border-b border-[#E8E4DC]">
              <div className="grid grid-cols-3 divide-x divide-[#E8E4DC]">
                {/* Demographics */}
                <div className="px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <User className="h-3 w-3 text-[#5A6B7A]" />
                    <span className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium">Demographics</span>
                  </div>
                  <div className="grid grid-cols-[80px_1fr] gap-y-1 gap-x-2 items-center">
                    <span className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium text-right">Name</span>
                    <input
                      type="text"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="—"
                      className="h-7 text-sm text-[#12354E] bg-transparent border-0 border-b border-[#E8E4DC] rounded-none outline-none focus:border-[#064F6E] px-1"
                    />
                    <span className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium text-right">MRN</span>
                    <input
                      type="text"
                      value={patientId}
                      onChange={(e) => setPatientId(e.target.value)}
                      placeholder="—"
                      className="h-7 text-sm text-[#12354E] bg-transparent border-0 border-b border-[#E8E4DC] rounded-none outline-none focus:border-[#064F6E] px-1"
                    />
                    <span className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium text-right">Age</span>
                    <input
                      type="number"
                      value={patientAge}
                      onChange={(e) => setPatientAge(e.target.value)}
                      placeholder="—"
                      className="h-7 text-sm text-[#12354E] bg-transparent border-0 border-b border-[#E8E4DC] rounded-none outline-none focus:border-[#064F6E] px-1"
                    />
                    <span className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium text-right">Sex</span>
                    <Select value={patientSex} onValueChange={setPatientSex}>
                      <SelectTrigger className="h-7 text-xs border-0 border-b border-[#E8E4DC] rounded-none shadow-none focus:ring-0 px-1">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unknown">Unknown</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium text-right">Wt/Ht</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={patientWeight}
                        onChange={(e) => setPatientWeight(e.target.value)}
                        placeholder="kg"
                        className="w-12 h-7 text-sm text-[#12354E] bg-transparent border-0 border-b border-[#E8E4DC] rounded-none outline-none focus:border-[#064F6E] px-1 text-center"
                      />
                      <span className="text-[#5A6B7A]">/</span>
                      <input
                        type="number"
                        value={patientHeight}
                        onChange={(e) => setPatientHeight(e.target.value)}
                        placeholder="cm"
                        className="w-12 h-7 text-sm text-[#12354E] bg-transparent border-0 border-b border-[#E8E4DC] rounded-none outline-none focus:border-[#064F6E] px-1 text-center"
                      />
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium text-right">Vitals</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {[
                        { label: "BP", value: patientBP, set: setPatientBP, w: "w-14" },
                        { label: "HR", value: patientHR, set: setPatientHR, w: "w-8" },
                        { label: "T°", value: patientTemp, set: setPatientTemp, w: "w-10" },
                        { label: "SpO2", value: patientSpO2, set: setPatientSpO2, w: "w-8" },
                      ].map(({ label, value, set, w }) => (
                        <div key={label} className="flex items-center gap-0.5">
                          <span className="text-[9px] text-[#5A6B7A]">{label}</span>
                          <input
                            type="text"
                            value={value}
                            onChange={(e) => set(e.target.value)}
                            placeholder="—"
                            className={`${w} h-6 text-xs text-[#12354E] bg-transparent border-0 border-b border-[#E8E4DC] rounded-none outline-none focus:border-[#064F6E] px-0.5 text-center`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Clinical Context */}
                <div className="px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Heart className="h-3 w-3 text-[#5A6B7A]" />
                    <span className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium">Clinical</span>
                  </div>
                  <div className="grid grid-cols-[80px_1fr] gap-y-1 gap-x-2 items-center">
                    <span className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium text-right">Allergies</span>
                    <input
                      type="text"
                      value={allergies}
                      onChange={(e) => setAllergies(e.target.value)}
                      placeholder="None known"
                      className="h-7 text-sm text-[#12354E] bg-transparent border-0 border-b border-[#E8E4DC] rounded-none outline-none focus:border-[#064F6E] px-1"
                    />
                    <span className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium text-right">Primary Dx</span>
                    <input
                      type="text"
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      placeholder="—"
                      className="h-7 text-sm text-[#12354E] bg-transparent border-0 border-b border-[#E8E4DC] rounded-none outline-none focus:border-[#064F6E] px-1"
                    />
                    <span className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium text-right">Alcohol</span>
                    <Select value={alcohol} onValueChange={setAlcohol}>
                      <SelectTrigger className="h-7 text-xs border-0 border-b border-[#E8E4DC] rounded-none shadow-none focus:ring-0 px-1">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="occasional">Occasional</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="heavy">Heavy</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium text-right">Tobacco</span>
                    <Select value={tobacco} onValueChange={setTobacco}>
                      <SelectTrigger className="h-7 text-xs border-0 border-b border-[#E8E4DC] rounded-none shadow-none focus:ring-0 px-1">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="never">Never</SelectItem>
                        <SelectItem value="former">Former</SelectItem>
                        <SelectItem value="current">Current</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium text-right">Liver</span>
                    <Select value={liverFunction} onValueChange={setLiverFunction}>
                      <SelectTrigger className="h-7 text-xs border-0 border-b border-[#E8E4DC] rounded-none shadow-none focus:ring-0 px-1">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="mild">Mild</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="severe">Severe</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium text-right">Kidney</span>
                    <Select value={kidneyFunction} onValueChange={setKidneyFunction}>
                      <SelectTrigger className="h-7 text-xs border-0 border-b border-[#E8E4DC] rounded-none shadow-none focus:ring-0 px-1">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="mild">Mild</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="severe">Severe</SelectItem>
                        <SelectItem value="dialysis">Dialysis</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Genetic Profile */}
                <div className="px-4 py-3 border-t-2 border-t-[#064F6E]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <FlaskConical className="h-3 w-3 text-[#5A6B7A]" />
                      <span className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium">Pharmacogenomics</span>
                      {isParsing && <Loader2 className="h-3 w-3 text-[#5A6B7A] animate-spin" />}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {reportUrl && (
                        <a
                          href={reportUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-[#064F6E] underline hover:text-[#12354E]"
                        >
                          View Report
                        </a>
                      )}
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 text-[#5A6B7A]" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Sourced from patient's pharmacogenomic lab report.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {(["CYP3A4", "CYP2D6", "CYP2C19", "CYP2C9"] as const).map((enzyme) => (
                      <div key={enzyme} className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: enzymeColors[enzyme] }}
                        />
                        <span className="text-xs font-medium text-[#12354E] w-14">{enzyme}</span>
                        <Select
                          value={geneticProfile[enzyme]}
                          onValueChange={(val) => setGeneticProfile((p) => ({ ...p, [enzyme]: val }))}
                        >
                          <SelectTrigger className="h-7 flex-1 text-xs border-0 border-b border-[#E8E4DC] rounded-none shadow-none focus:ring-0 px-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Normal">Normal</SelectItem>
                            <SelectItem value="Intermediate">Intermediate</SelectItem>
                            <SelectItem value="Poor">Poor</SelectItem>
                            <SelectItem value="Rapid">Rapid</SelectItem>
                            <SelectItem value="Ultra-rapid">Ultra-rapid</SelectItem>
                            <SelectItem value="Unknown">Unknown</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Bar - 40px */}
            <div className="h-10 min-h-10 bg-[#F4F1EB] border-b border-[#E8E4DC] px-4 flex items-center justify-between">
              <span className="text-xs text-[#5A6B7A]">
                Ready to analyze {selectedDrugs.length} medication(s) against genetic profile
              </span>
              <Button
                onClick={analyzeInteractions}
                disabled={selectedDrugs.length === 0 || isAnalyzing}
                className="h-8 px-6 text-sm font-medium bg-[#064F6E] text-white rounded-md hover:shadow-[0_0_12px_rgba(167,212,228,0.4)] disabled:opacity-40"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  "Analyze Interactions"
                )}
              </Button>
            </div>

            {/* Bottom Area - Analysis + Notes split 58/42 */}
            <div className="flex-1 flex gap-3 p-3 overflow-hidden">
              {/* Analysis Panel - 58% */}
              <div className="w-[58%] border border-[#E8E4DC] rounded-lg bg-[#FDFBF7] overflow-y-auto scrollbar-hide">
                {showAnalysis && analysisResult && (
                  <div className="p-4">
                    {analysisResult.unmatchedDrugs && analysisResult.unmatchedDrugs.length > 0 && (
                      <div className="bg-yellow-50 border border-yellow-300 rounded-md p-3 mb-4">
                        <p className="text-sm text-yellow-800 font-medium">⚠️ Drugs not in our database:</p>
                        <p className="text-sm text-yellow-700">
                          {analysisResult.unmatchedDrugs.join(", ")} — results may be incomplete.
                        </p>
                      </div>
                    )}
                    {/* Risk Banner */}
                    <div
                      className={`rounded-md p-3 border-l-[3px] ${riskColors[analysisResult.overallRisk].border} ${riskColors[analysisResult.overallRisk].light} animate-section-1`}
                    >
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-[#12354E] flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <Badge className={`${riskColors[analysisResult.overallRisk].bg} ${riskColors[analysisResult.overallRisk].text} text-xs mb-1`}>
                            {analysisResult.overallRisk}
                          </Badge>
                          <p className="text-sm leading-snug text-[#12354E]">{analysisResult.summary}</p>
                        </div>
                      </div>
                    </div>

                    {/* Enzyme Activity */}
                    <div className="mt-4 animate-section-2">
                      <h3 className="text-xs uppercase tracking-wider text-[#5A6B7A] font-medium mb-2">Enzyme Activity</h3>
                      <div className="flex flex-col gap-1.5">
                        {analysisResult.enzymeActivity.map((enzyme) => (
                          <div
                            key={enzyme.enzyme}
                            className={`rounded-md bg-white p-2.5 border-l-[3px] ${riskColors[enzyme.riskLevel].border}`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: enzymeColors[enzyme.enzyme] }}
                                />
                                <span className="text-sm font-medium text-[#12354E]">{enzyme.enzyme}</span>
                                {enzyme.phenoconversion && (
                                  <span className="text-xs text-[#F99D1B]">
                                    {enzyme.phenoconversion.from} → {enzyme.phenoconversion.to}
                                  </span>
                                )}
                              </div>
                              <Badge className={`${riskColors[enzyme.riskLevel].bg} ${riskColors[enzyme.riskLevel].text} text-[10px]`}>
                                {enzyme.riskLevel}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {[
                                ...(enzyme.substrates ?? []).map(d => ({ name: d, role: "substrate" as const })),
                                ...(enzyme.inhibitors ?? []).map(d => ({ name: d, role: "inhibitor" as const })),
                                ...(enzyme.inducers ?? []).map(d => ({ name: d, role: "inducer" as const })),
                              ].map((drug, idx) => (
                                <span
                                  key={idx}
                                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                                    drug.role === "substrate"
                                      ? "bg-[#064F6E] text-white"
                                      : drug.role === "inhibitor"
                                        ? "bg-[#F99D1B] text-[#12354E]"
                                        : "bg-[#C0392B] text-white"
                                  }`}
                                >
                                  {drug.name} ({drug.role})
                                </span>
                              ))}
                            </div>
                            {enzyme.riskReason && (
                              <p className="text-[10px] text-[#5A6B7A] mt-1.5">{enzyme.riskReason}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Drug Interactions */}
                    {sortedDrugIssues.length > 0 && (
                      <div className="mt-4 animate-section-3">
                        <h3 className="text-xs uppercase tracking-wider text-[#5A6B7A] font-medium mb-2">Interactions</h3>
                        <Accordion type="multiple" className="flex flex-col gap-1.5">
                          {sortedDrugIssues.map((issue, idx) => (
                            <AccordionItem
                              key={idx}
                              value={`issue-${idx}`}
                              className={`border rounded-md bg-white border-l-[3px] ${riskColors[issue.riskLevel].border}`}
                            >
                              <AccordionTrigger className="py-2 px-3 hover:no-underline">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-[#12354E]">{issue.drug}</span>
                                  <Badge className={`${riskColors[issue.riskLevel].bg} ${riskColors[issue.riskLevel].text} text-[10px]`}>
                                    {issue.riskLevel}
                                  </Badge>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="py-2 px-3">
                                <div className="space-y-2 text-xs leading-relaxed text-[#5A6B7A]">
                                  <p>
                                    <span className="font-medium text-[#12354E]">Issue:</span> {issue.issue}
                                  </p>
                                  <p>
                                    <span className="font-medium text-[#12354E]">Mechanism:</span> {issue.mechanism}
                                  </p>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </div>
                    )}

                    {/* AI Reasoning Trace */}
                    <details className="mt-4 text-xs text-gray-500">
                      <summary className="cursor-pointer font-medium select-none hover:text-gray-700">
                        🔍 View AI Reasoning Trace
                      </summary>
                      <div className="mt-2 space-y-3">
                        <div>
                          <p className="font-medium text-gray-600 mb-1">Collision Map (deterministic engine)</p>
                          <pre className="bg-gray-100 p-3 rounded overflow-auto max-h-64 text-[10px] leading-relaxed">
                            {JSON.stringify(analysisResult.rawCollisionMap, null, 2)}
                          </pre>
                        </div>
                        {analysisResult.ragContext && (
                          <div>
                            <p className="font-medium text-gray-600 mb-1">RAG Context (retrieved chunks)</p>
                            <pre className="bg-gray-100 p-3 rounded overflow-auto max-h-64 text-[10px] leading-relaxed whitespace-pre-wrap">
                              {analysisResult.ragContext}
                            </pre>
                          </div>
                        )}
                      </div>
                    </details>

                    {/* Sources footnote */}
                    <div className="mt-6 text-center animate-section-4">
                      <span className="text-[10px] text-[#5A6B7A]">
                        Sources: PharmGKB · CPIC Guidelines · FDA Drug Interaction Tables · DrugBank
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Physician Notes - 42% */}
              <div className="w-[42%] border border-[#E8E4DC] rounded-lg bg-white flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-[#E8E4DC]">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-[#064F6E]" />
                    <span className="text-sm font-semibold text-[#12354E]">Physician Notes</span>
                    {noteSubmitted && (
                      <span className="text-[10px] text-[#27AE60] font-medium">&#x25CF; Submitted</span>
                    )}
                  </div>
                  <button
                    onClick={copyNotes}
                    className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[#F4F1EB] text-[#5A6B7A] hover:text-[#064F6E]"
                  >
                    {copied ? <Check className="w-4 h-4 text-[#27AE60]" /> : <ClipboardCopy className="w-4 h-4" />}
                  </button>
                </div>

                {/* Note Body */}
                <div className="flex-1 overflow-y-auto scrollbar-hide px-3 py-2 space-y-3">
                  {noteSubmittedAt && (
                    <div className="text-[10px] text-[#5A6B7A] bg-[#F4F1EB] px-2 py-1 rounded">
                      Submitted to patient record: {noteSubmittedAt}
                    </div>
                  )}

                  {/* Medication Review */}
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium mb-1.5 border-b border-[#E8E4DC] pb-1">
                      Medication Review
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {([
                        { label: "Current Regimen Assessed", checked: medReviewAssessed, toggle: () => setMedReviewAssessed(v => !v) },
                        { label: "Interactions Identified", checked: medReviewInteractions, toggle: () => setMedReviewInteractions(v => !v) },
                      ] as { label: string; checked: boolean; toggle: () => void }[]).map(({ label, checked, toggle }) => (
                        <div key={label} className="flex items-center gap-2 cursor-pointer" onClick={toggle}>
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${checked ? "bg-[#064F6E] border-[#064F6E]" : "border-[#C4B9A8] hover:border-[#064F6E]"}`}>
                            {checked && <Check className="w-2.5 h-2.5 text-white" />}
                          </div>
                          <span className="text-xs text-[#12354E] select-none">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Clinical Decision */}
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium mb-1.5 border-b border-[#E8E4DC] pb-1">
                      Clinical Decision
                    </div>
                    <div className="text-[10px] text-[#5A6B7A] mb-1.5">Action Taken:</div>
                    <div className="flex flex-col gap-1.5">
                      {/* No changes */}
                      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setClinicalNoChanges(v => !v)}>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${clinicalNoChanges ? "bg-[#064F6E] border-[#064F6E]" : "border-[#C4B9A8] hover:border-[#064F6E]"}`}>
                          {clinicalNoChanges && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <span className="text-xs text-[#12354E] select-none">No changes required</span>
                      </div>

                      {/* Dose adjustment */}
                      <div className="flex items-start gap-2">
                        <div className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${clinicalDoseAdjust ? "bg-[#064F6E] border-[#064F6E]" : "border-[#C4B9A8] hover:border-[#064F6E]"}`} onClick={() => setClinicalDoseAdjust(v => !v)}>
                          {clinicalDoseAdjust && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <div className="flex-1">
                          <span className="text-xs text-[#12354E]">Dose adjustment:</span>
                          <input
                            type="text"
                            value={clinicalDoseAdjustNote}
                            onChange={(e) => { setClinicalDoseAdjustNote(e.target.value); if (e.target.value) setClinicalDoseAdjust(true) }}
                            className="w-full h-6 text-xs text-[#12354E] bg-transparent outline-none px-0 border-b border-[#12354E] mt-0.5"
                          />
                        </div>
                      </div>

                      {/* Drug substitution */}
                      <div className="flex items-start gap-2">
                        <div className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${clinicalDrugSub ? "bg-[#064F6E] border-[#064F6E]" : "border-[#C4B9A8] hover:border-[#064F6E]"}`} onClick={() => setClinicalDrugSub(v => !v)}>
                          {clinicalDrugSub && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <div className="flex-1">
                          <span className="text-xs text-[#12354E]">Drug substitution:</span>
                          <input
                            type="text"
                            value={clinicalDrugSubNote}
                            onChange={(e) => { setClinicalDrugSubNote(e.target.value); if (e.target.value) setClinicalDrugSub(true) }}
                            className="w-full h-6 text-xs text-[#12354E] bg-transparent outline-none px-0 border-b border-[#12354E] mt-0.5"
                          />
                        </div>
                      </div>

                      {/* Monitoring */}
                      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setClinicalMonitoring(v => !v)}>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${clinicalMonitoring ? "bg-[#064F6E] border-[#064F6E]" : "border-[#C4B9A8] hover:border-[#064F6E]"}`}>
                          {clinicalMonitoring && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <span className="text-xs text-[#12354E] select-none">Additional monitoring ordered</span>
                      </div>

                      {/* Referral */}
                      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setClinicalReferral(v => !v)}>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${clinicalReferral ? "bg-[#064F6E] border-[#064F6E]" : "border-[#C4B9A8] hover:border-[#064F6E]"}`}>
                          {clinicalReferral && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <span className="text-xs text-[#12354E] select-none">Referral to specialist</span>
                      </div>
                    </div>

                    {/* Rationale */}
                    <div className="mt-2">
                      <div className="text-[10px] text-[#5A6B7A] mb-1">Rationale:</div>
                      <textarea
                        value={clinicalRationale}
                        onChange={(e) => setClinicalRationale(e.target.value)}
                        rows={3}
                        className="w-full text-xs text-[#12354E] bg-[#FDFBF7] border border-[#E8E4DC] rounded px-2 py-1.5 outline-none resize-none focus:border-[#064F6E]"
                      />
                    </div>
                  </div>

                  {/* Plan & Follow-Up */}
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium mb-1.5 border-b border-[#E8E4DC] pb-1">
                      Plan & Follow-Up
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {([
                        { n: "1", val: planItem1, set: setPlanItem1 },
                        { n: "2", val: planItem2, set: setPlanItem2 },
                        { n: "3", val: planItem3, set: setPlanItem3 },
                      ] as { n: string; val: string; set: (v: string) => void }[]).map(({ n, val, set }) => (
                        <div key={n} className="flex items-center gap-1.5">
                          <span className="text-xs text-[#5A6B7A] shrink-0">{n}.</span>
                          <input
                            type="text"
                            value={val}
                            onChange={(e) => set(e.target.value)}
                            className="flex-1 h-6 text-xs text-[#12354E] bg-transparent outline-none border-b border-[#E8E4DC] focus:border-[#064F6E] px-0.5"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Follow-up Date */}
                    <div className="mt-2">
                      <div className="text-[10px] text-[#5A6B7A] mb-1">Next Review Date:</div>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={followUpDay}
                          onChange={(e) => setFollowUpDay(e.target.value)}
                          className="h-7 text-xs text-[#12354E] bg-[#F4F1EB] border border-[#E8E4DC] rounded px-1 outline-none focus:border-[#064F6E]"
                        >
                          <option value="">Day</option>
                          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                            <option key={d} value={String(d).padStart(2, "0")}>{String(d).padStart(2, "0")}</option>
                          ))}
                        </select>
                        <select
                          value={followUpMonth}
                          onChange={(e) => setFollowUpMonth(e.target.value)}
                          className="h-7 text-xs text-[#12354E] bg-[#F4F1EB] border border-[#E8E4DC] rounded px-1 outline-none focus:border-[#064F6E]"
                        >
                          <option value="">Month</option>
                          {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                        <select
                          value={followUpYear}
                          onChange={(e) => setFollowUpYear(e.target.value)}
                          className="h-7 text-xs text-[#12354E] bg-[#F4F1EB] border border-[#E8E4DC] rounded px-1 outline-none focus:border-[#064F6E]"
                        >
                          <option value="">Year</option>
                          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i).map((y) => (
                            <option key={y} value={String(y)}>{y}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Early visit condition */}
                    <div className="mt-2">
                      <div className="text-[10px] text-[#5A6B7A] mb-1">Patient may return earlier if:</div>
                      <textarea
                        value={earlyVisitNote}
                        onChange={(e) => setEarlyVisitNote(e.target.value)}
                        rows={2}
                        className="w-full text-xs text-[#12354E] bg-[#FDFBF7] border border-[#E8E4DC] rounded px-2 py-1.5 outline-none resize-none focus:border-[#064F6E]"
                        placeholder="Specify conditions for earlier visit..."
                      />
                    </div>
                  </div>
                </div>

                {/* Footer - Save & Submit */}
                <div className="px-3 pb-2.5 pt-2 border-t border-[#E8E4DC] flex items-center justify-between gap-2">
                  <div>
                    {noteSavedAt && !noteSubmitted && (
                      <span className="text-[10px] text-[#5A6B7A]">Saved {noteSavedAt}</span>
                    )}
                    {noteSubmitted && (
                      <span className="text-[10px] text-[#27AE60]">Submitted {noteSubmittedAt}</span>
                    )}
                  </div>
                  {!noteSubmitted && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveNote}
                        className="h-7 px-3 text-xs font-medium text-[#064F6E] border border-[#064F6E] rounded-md hover:bg-[#064F6E]/5 transition-colors"
                      >
                        Save Draft
                      </button>
                      <button
                        onClick={() => setShowSubmitModal(true)}
                        className="h-7 px-3 text-xs font-medium bg-[#064F6E] text-white rounded-md hover:bg-[#12354E] transition-colors"
                      >
                        Submit Note
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Auth Modal */}
        {showSubmitModal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-xl p-6 w-80 border border-[#E8E4DC]">
              <h3 className="text-sm font-semibold text-[#12354E] mb-1">Confirm Submission</h3>
              <p className="text-xs text-[#5A6B7A] mb-4">Enter your credentials to submit this note to the patient record.</p>
              <div className="flex flex-col gap-2 mb-4">
                <input
                  type="text"
                  value={submitDocId}
                  onChange={(e) => setSubmitDocId(e.target.value)}
                  placeholder="Doctor ID"
                  className="h-9 text-sm text-[#12354E] bg-[#F4F1EB] border border-[#E8E4DC] rounded-md outline-none focus:border-[#064F6E] px-3"
                />
                <input
                  type="password"
                  value={submitDocPassword}
                  onChange={(e) => setSubmitDocPassword(e.target.value)}
                  placeholder="Password"
                  className="h-9 text-sm text-[#12354E] bg-[#F4F1EB] border border-[#E8E4DC] rounded-md outline-none focus:border-[#064F6E] px-3"
                  onKeyDown={(e) => e.key === "Enter" && handleSubmitNote()}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowSubmitModal(false); setSubmitDocId(""); setSubmitDocPassword("") }}
                  className="flex-1 h-9 text-sm text-[#5A6B7A] border border-[#E8E4DC] rounded-md hover:bg-[#F4F1EB] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitNote}
                  disabled={!submitDocId || !submitDocPassword}
                  className="flex-1 h-9 text-sm font-medium bg-[#064F6E] text-white rounded-md hover:bg-[#12354E] disabled:opacity-40 transition-colors"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

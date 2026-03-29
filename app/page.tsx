"use client"

import { useState, useEffect, useRef, useMemo } from "react"
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

const enzymeColors: Record<string, string> = {
  CYP3A4: "#064F6E",
  CYP2D6: "#F99D1B",
  CYP2C19: "#27AE60",
  CYP2C9: "#E67E22",
}

const noteTemplate = `PHARMACOGENOMIC INTERACTION ASSESSMENT
═══════════════════════════════════════
Date:       ___/___/______
Provider:   _________________________
Patient:    _________________________

━━━ MEDICATION REVIEW ━━━━━━━━━━━━━━━
Current Regimen Assessed:  □ Yes  □ No
Interactions Identified:   □ Yes  □ No

━━━ CLINICAL DECISION ━━━━━━━━━━━━━━━
Action Taken:
□ No changes required
□ Dose adjustment: ___________________
□ Drug substitution: _________________
□ Additional monitoring ordered
□ Referral to specialist

Rationale:



━━━ PLAN & FOLLOW-UP ━━━━━━━━━━━━━━━
1.
2.
3.

Next Review Date: ___/___/______

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Signature: _________________________`

export default function PolyPGxPage() {
  // Provider state
  const [providerName] = useState("Dr. Demo")

  // Patient state
  const [patientName, setPatientName] = useState("")
  const [patientAge, setPatientAge] = useState("")
  const [patientSex, setPatientSex] = useState("")
  const [patientWeight, setPatientWeight] = useState("")
  const [patientHeight, setPatientHeight] = useState("")

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
  const [physicianNotes, setPhysicianNotes] = useState(noteTemplate)
  const [copied, setCopied] = useState(false)
  const [currentTimestamp, setCurrentTimestamp] = useState("")

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
      })
      setShowAnalysis(true)
    } catch {
      // Handle error silently
    } finally {
      setIsAnalyzing(false)
    }
  }

  const copyNotes = async () => {
    await navigator.clipboard.writeText(physicianNotes)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const sortedDrugIssues = useMemo(() => {
    if (!analysisResult?.drugIssues) return []
    return [...analysisResult.drugIssues].sort((a, b) => RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel])
  }, [analysisResult?.drugIssues])

  return (
    <TooltipProvider>
      <div className="h-screen overflow-hidden bg-[#FDFBF7] flex flex-col">
        {/* Header - 40px */}
        <header className="h-10 min-h-10 bg-white border-b border-[#E8E4DC] flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Dna className="h-5 w-5 text-[#064F6E]" />
            <span className="text-lg font-bold text-[#12354E]">PolyPGx</span>
            <span className="text-[#E8E4DC]">·</span>
            <span className="text-xs text-[#5A6B7A]">Clinical Interaction Analyzer</span>
          </div>
          <div className="border-l border-[#E8E4DC] pl-3">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#5A6B7A] font-medium">
              FOR RESEARCH USE ONLY
            </span>
          </div>
        </header>

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

              {/* Drug chips area */}
              <div className="flex-1 mt-2 overflow-y-auto scrollbar-hide">
                {selectedDrugs.length === 0 ? (
                  <div className="text-xs text-[#5A6B7A] text-center py-4">No medications added</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 content-start">
                    {selectedDrugs.map((drug) => (
                      <span
                        key={drug.rxcui}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-[#F4F1EB] text-[#12354E] rounded-full ${
                          addedDrug === drug.rxcui ? "animate-scale-in" : ""
                        }`}
                      >
                        {drug.name}
                        <button onClick={() => removeDrug(drug.rxcui)} className="hover:text-[#C0392B]">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer line */}
              <div className="border-t border-[#E8E4DC] pt-2 mt-auto">
                <span className="text-[10px] text-[#5A6B7A]">{selectedDrugs.length} medication(s)</span>
              </div>
            </div>

            {/* Session Indicator - 48px fixed */}
            <div className="h-12 min-h-12 bg-[#F4F1EB] px-3 flex items-center gap-2 border-t border-[#E8E4DC]">
              <div className="w-7 h-7 rounded-full bg-white border border-[#E8E4DC] flex items-center justify-center">
                <CircleUser className="w-4 h-4 text-[#064F6E]" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-medium text-[#12354E]">{providerName}</div>
                <div className="flex items-center gap-1 text-[10px] text-[#5A6B7A]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#27AE60]" />
                  Active Session
                </div>
              </div>
              <button className="text-[10px] text-[#5A6B7A] underline cursor-pointer">Sign Out</button>
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
                      placeholder="Patient ID"
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
                    </div>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3 text-[#5A6B7A]" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Based on pharmacogenomic test results (e.g., GeneSight, OneOme).</p>
                      </TooltipContent>
                    </Tooltip>
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
                <div className="flex items-center justify-between px-3 pt-3 pb-2">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-[#064F6E]" />
                    <span className="text-sm font-semibold text-[#12354E]">Physician Notes</span>
                  </div>
                  <button
                    onClick={copyNotes}
                    className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[#F4F1EB] text-[#5A6B7A] hover:text-[#064F6E]"
                  >
                    {copied ? <Check className="w-4 h-4 text-[#27AE60]" /> : <ClipboardCopy className="w-4 h-4" />}
                  </button>
                </div>

                {/* Textarea */}
                <textarea
                  value={physicianNotes}
                  onChange={(e) => setPhysicianNotes(e.target.value)}
                  className="flex-1 bg-[#FDFBF7] border-0 p-3 text-sm font-mono text-[#12354E] leading-relaxed resize-none overflow-y-auto scrollbar-hide outline-none"
                />

                {/* Footer */}
                <div className="px-3 pb-2 pt-1 border-t border-[#E8E4DC] flex items-center justify-between">
                  <span className="text-[10px] text-[#5A6B7A]">Auto-saved</span>
                  <span className="text-[10px] text-[#5A6B7A]">{currentTimestamp}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

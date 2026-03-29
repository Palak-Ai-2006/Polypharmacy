"use client"

import { User, Heart, FlaskConical, Info, Loader2 } from "lucide-react"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { usePolyPGxStore } from "@/lib/store"

const enzymeColors: Record<string, string> = {
  CYP3A4: "#064F6E",
  CYP2D6: "#F99D1B",
  CYP2C19: "#27AE60",
  CYP2C9: "#E67E22",
}

export function PatientInfoSidebar() {
  const s = usePolyPGxStore()

  return (
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
            <input type="text" value={s.patientName} onChange={(e) => s.setPatientName(e.target.value)} placeholder="---"
              className="h-7 text-sm text-[#12354E] bg-transparent border-0 border-b border-[#E8E4DC] rounded-none outline-none focus:border-[#064F6E] px-1" />

            <span className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium text-right">MRN</span>
            <input type="text" value={s.patientId} onChange={(e) => s.setPatientId(e.target.value)} placeholder="---"
              className="h-7 text-sm text-[#12354E] bg-transparent border-0 border-b border-[#E8E4DC] rounded-none outline-none focus:border-[#064F6E] px-1" />

            <span className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium text-right">Age</span>
            <input type="number" value={s.patientAge} onChange={(e) => s.setPatientAge(e.target.value)} placeholder="---"
              className="h-7 text-sm text-[#12354E] bg-transparent border-0 border-b border-[#E8E4DC] rounded-none outline-none focus:border-[#064F6E] px-1" />

            <span className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium text-right">Sex</span>
            <Select value={s.patientSex} onValueChange={s.setPatientSex}>
              <SelectTrigger className="h-7 text-xs border-0 border-b border-[#E8E4DC] rounded-none shadow-none focus:ring-0 px-1">
                <SelectValue placeholder="---" />
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
              <input type="number" value={s.patientWeight} onChange={(e) => s.setPatientWeight(e.target.value)} placeholder="kg"
                className="w-12 h-7 text-sm text-[#12354E] bg-transparent border-0 border-b border-[#E8E4DC] rounded-none outline-none focus:border-[#064F6E] px-1 text-center" />
              <span className="text-[#5A6B7A]">/</span>
              <input type="number" value={s.patientHeight} onChange={(e) => s.setPatientHeight(e.target.value)} placeholder="cm"
                className="w-12 h-7 text-sm text-[#12354E] bg-transparent border-0 border-b border-[#E8E4DC] rounded-none outline-none focus:border-[#064F6E] px-1 text-center" />
            </div>

            <span className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium text-right">Vitals</span>
            <div className="flex items-center gap-2 flex-wrap">
              {([
                { label: "BP", value: s.patientBP, set: s.setPatientBP, w: "w-14" },
                { label: "HR", value: s.patientHR, set: s.setPatientHR, w: "w-8" },
                { label: "T\u00B0", value: s.patientTemp, set: s.setPatientTemp, w: "w-10" },
                { label: "SpO2", value: s.patientSpO2, set: s.setPatientSpO2, w: "w-8" },
              ] as const).map(({ label, value, set, w }) => (
                <div key={label} className="flex items-center gap-0.5">
                  <span className="text-[9px] text-[#5A6B7A]">{label}</span>
                  <input type="text" value={value} onChange={(e) => set(e.target.value)} placeholder="---"
                    className={`${w} h-6 text-xs text-[#12354E] bg-transparent border-0 border-b border-[#E8E4DC] rounded-none outline-none focus:border-[#064F6E] px-0.5 text-center`} />
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
            <input type="text" value={s.allergies} onChange={(e) => s.setAllergies(e.target.value)} placeholder="None known"
              className="h-7 text-sm text-[#12354E] bg-transparent border-0 border-b border-[#E8E4DC] rounded-none outline-none focus:border-[#064F6E] px-1" />

            <span className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium text-right">Primary Dx</span>
            <input type="text" value={s.diagnosis} onChange={(e) => s.setDiagnosis(e.target.value)} placeholder="---"
              className="h-7 text-sm text-[#12354E] bg-transparent border-0 border-b border-[#E8E4DC] rounded-none outline-none focus:border-[#064F6E] px-1" />

            {([
              { label: "Alcohol", value: s.alcohol, set: s.setAlcohol, options: ["none","occasional","moderate","heavy"] },
              { label: "Tobacco", value: s.tobacco, set: s.setTobacco, options: ["never","former","current"] },
              { label: "Liver", value: s.liverFunction, set: s.setLiverFunction, options: ["normal","mild","moderate","severe"] },
              { label: "Kidney", value: s.kidneyFunction, set: s.setKidneyFunction, options: ["normal","mild","moderate","severe","dialysis"] },
            ] as const).map(({ label, value, set, options }) => (
              <SelectRow key={label} label={label} value={value} onValueChange={set} options={options} />
            ))}
          </div>
        </div>

        {/* Genetic Profile */}
        <div className="px-4 py-3 border-t-2 border-t-[#064F6E]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <FlaskConical className="h-3 w-3 text-[#5A6B7A]" />
              <span className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium">Pharmacogenomics</span>
              {s.isParsing && <Loader2 className="h-3 w-3 text-[#5A6B7A] animate-spin" />}
            </div>
            <div className="flex items-center gap-1.5">
              {s.reportUrl && (
                <a href={s.reportUrl} target="_blank" rel="noreferrer"
                  className="text-[10px] text-[#064F6E] underline hover:text-[#12354E]">
                  View Report
                </a>
              )}
              <Tooltip>
                <TooltipTrigger><Info className="h-3 w-3 text-[#5A6B7A]" /></TooltipTrigger>
                <TooltipContent><p className="text-xs">Sourced from patient pharmacogenomic lab report.</p></TooltipContent>
              </Tooltip>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {(["CYP3A4", "CYP2D6", "CYP2C19", "CYP2C9"] as const).map((enzyme) => (
              <div key={enzyme} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: enzymeColors[enzyme] }} />
                <span className="text-xs font-medium text-[#12354E] w-14">{enzyme}</span>
                <Select
                  value={s.geneticProfile[enzyme]}
                  onValueChange={(val) => s.setEnzyme(enzyme, val)}
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
  )
}

// Helper component for select rows
function SelectRow({ label, value, onValueChange, options }: {
  label: string; value: string; onValueChange: (v: string) => void; options: readonly string[]
}) {
  return (
    <>
      <span className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium text-right">{label}</span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-7 text-xs border-0 border-b border-[#E8E4DC] rounded-none shadow-none focus:ring-0 px-1">
          <SelectValue placeholder="---" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )
}

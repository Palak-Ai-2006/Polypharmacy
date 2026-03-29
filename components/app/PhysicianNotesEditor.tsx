"use client"

import { useCallback, useEffect, useState } from "react"
import { Stethoscope, ClipboardCopy, Check, Printer } from "lucide-react"
import { toast } from "sonner"
import { usePolyPGxStore } from "@/lib/store"

const CLINICAL_DECISIONS = [
  { id: "no_change", label: "No changes required" },
  { id: "dose_adj", label: "Dose adjustment" },
  { id: "substitution", label: "Drug substitution" },
  { id: "monitoring", label: "Additional monitoring ordered" },
  { id: "referral", label: "Referral to specialist" },
]

export function PhysicianNotesEditor() {
  const { selectedDrugs, patientName, patientId, primaryDocName, primaryDocSpecialty } =
    usePolyPGxStore()

  // Medication review
  const [reviewedDrugs, setReviewedDrugs] = useState<Record<string, boolean>>({})

  // Clinical decisions
  const [decisions, setDecisions] = useState<Record<string, boolean>>({})
  const [doseDetail, setDoseDetail] = useState("")
  const [subDetail, setSubDetail] = useState("")

  // Free-text fields
  const [rationale, setRationale] = useState("")
  const [plan1, setPlan1] = useState("")
  const [plan2, setPlan2] = useState("")
  const [plan3, setPlan3] = useState("")
  const [followUp, setFollowUp] = useState("")

  const [copied, setCopied] = useState(false)
  const [timestamp, setTimestamp] = useState("")

  useEffect(() => {
    setTimestamp(
      new Date().toLocaleString("en-US", {
        month: "short", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit", hour12: true,
      })
    )
  }, [])

  const toggleDrug = (name: string) =>
    setReviewedDrugs((prev) => ({ ...prev, [name]: !prev[name] }))

  const toggleDecision = (id: string) =>
    setDecisions((prev) => ({ ...prev, [id]: !prev[id] }))

  const compileNote = useCallback(() => {
    const lines: string[] = []
    lines.push("PHARMACOGENOMIC INTERACTION ASSESSMENT")
    lines.push("===================================")
    lines.push(`Date:       ${timestamp}`)
    lines.push(`Provider:   ${primaryDocName || "—"}${primaryDocSpecialty ? ` (${primaryDocSpecialty})` : ""}`)
    lines.push(`Patient:    ${patientName || "—"}${patientId ? `  MRN: ${patientId}` : ""}`)
    lines.push("")

    lines.push("--- MEDICATION REVIEW ---------------")
    if (selectedDrugs.length === 0) {
      lines.push("No medications listed.")
    } else {
      selectedDrugs.forEach((d) => {
        lines.push(`[${reviewedDrugs[d.name] ? "X" : " "}] ${d.name}`)
      })
    }
    lines.push("")

    lines.push("--- CLINICAL DECISION ---------------")
    lines.push("Action Taken:")
    CLINICAL_DECISIONS.forEach((dec) => {
      const checked = decisions[dec.id] ? "X" : " "
      if (dec.id === "dose_adj") {
        lines.push(`[${checked}] Dose adjustment${doseDetail ? `: ${doseDetail}` : ": ___________________"}`)
      } else if (dec.id === "substitution") {
        lines.push(`[${checked}] Drug substitution${subDetail ? `: ${subDetail}` : ": _________________"}`)
      } else {
        lines.push(`[${checked}] ${dec.label}`)
      }
    })
    lines.push("")

    lines.push("Rationale:")
    lines.push(rationale.trim() || "")
    lines.push("")

    lines.push("--- PLAN & FOLLOW-UP ----------------")
    lines.push(`1. ${plan1}`)
    lines.push(`2. ${plan2}`)
    lines.push(`3. ${plan3}`)
    lines.push("")
    lines.push(`Next Review Date: ${followUp || "___/___/______"}`)
    lines.push("")
    lines.push("------------------------------------")
    lines.push("FOR RESEARCH USE ONLY — NOT FOR CLINICAL DECISION-MAKING")

    return lines.join("\n")
  }, [
    timestamp, primaryDocName, primaryDocSpecialty,
    patientName, patientId, selectedDrugs, reviewedDrugs,
    decisions, doseDetail, subDetail, rationale,
    plan1, plan2, plan3, followUp,
  ])

  const copyNotes = useCallback(async () => {
    await navigator.clipboard.writeText(compileNote())
    setCopied(true)
    toast.success("Clinical note copied to clipboard")
    setTimeout(() => setCopied(false), 1500)
  }, [compileNote])

  const printNotes = useCallback(() => window.print(), [])

  return (
    <div className="w-[42%] border border-[#E8E4DC] rounded-lg bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-[#E8E4DC] shrink-0">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-[#064F6E]" />
          <span className="text-sm font-semibold text-[#12354E]">Physician Notes</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={printNotes}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[#F4F1EB] text-[#5A6B7A] hover:text-[#064F6E] print:hidden"
            title="Print"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button
            onClick={copyNotes}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[#F4F1EB] text-[#5A6B7A] hover:text-[#064F6E] print:hidden"
            title="Copy note"
          >
            {copied ? <Check className="w-4 h-4 text-[#27AE60]" /> : <ClipboardCopy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Form body */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-3 space-y-4">

        {/* Medication Review */}
        <section>
          <p className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium mb-2">
            Medication Review
          </p>
          {selectedDrugs.length === 0 ? (
            <p className="text-xs text-[#5A6B7A] italic">No medications added yet.</p>
          ) : (
            <div className="space-y-1.5">
              {selectedDrugs.map((d) => (
                <label key={d.rxcui} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={!!reviewedDrugs[d.name]}
                    onChange={() => toggleDrug(d.name)}
                    className="h-3.5 w-3.5 rounded border-[#E8E4DC] accent-[#064F6E] cursor-pointer"
                  />
                  <span className="text-xs text-[#12354E] group-hover:text-[#064F6E] transition-colors">
                    {d.name}
                  </span>
                </label>
              ))}
            </div>
          )}
        </section>

        <div className="border-t border-[#E8E4DC]" />

        {/* Clinical Decision */}
        <section>
          <p className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium mb-2">
            Clinical Decision
          </p>
          <div className="space-y-2">
            {CLINICAL_DECISIONS.map((dec) => (
              <div key={dec.id}>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={!!decisions[dec.id]}
                    onChange={() => toggleDecision(dec.id)}
                    className="h-3.5 w-3.5 rounded border-[#E8E4DC] accent-[#064F6E] cursor-pointer"
                  />
                  <span className="text-xs text-[#12354E] group-hover:text-[#064F6E] transition-colors">
                    {dec.label}
                  </span>
                </label>

                {dec.id === "dose_adj" && decisions["dose_adj"] && (
                  <input
                    type="text"
                    value={doseDetail}
                    onChange={(e) => setDoseDetail(e.target.value)}
                    placeholder="Specify drug and new dose…"
                    className="ml-5 mt-1 w-[calc(100%-1.25rem)] h-7 bg-[#F4F1EB] border border-[#E8E4DC] rounded px-2 text-xs text-[#12354E] outline-none focus:border-[#064F6E]"
                  />
                )}

                {dec.id === "substitution" && decisions["substitution"] && (
                  <input
                    type="text"
                    value={subDetail}
                    onChange={(e) => setSubDetail(e.target.value)}
                    placeholder="Replace with…"
                    className="ml-5 mt-1 w-[calc(100%-1.25rem)] h-7 bg-[#F4F1EB] border border-[#E8E4DC] rounded px-2 text-xs text-[#12354E] outline-none focus:border-[#064F6E]"
                  />
                )}
              </div>
            ))}
          </div>
        </section>

        <div className="border-t border-[#E8E4DC]" />

        {/* Rationale */}
        <section>
          <p className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium mb-1">
            Rationale
          </p>
          <textarea
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="Clinical reasoning for decisions made…"
            rows={3}
            className="w-full bg-[#FDFBF7] border border-[#E8E4DC] rounded-md p-2 text-xs text-[#12354E] leading-relaxed resize-none outline-none focus:border-[#064F6E] placeholder:text-[#5A6B7A]/60"
          />
        </section>

        <div className="border-t border-[#E8E4DC]" />

        {/* Plan */}
        <section>
          <p className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium mb-2">
            Plan
          </p>
          <div className="space-y-1.5">
            {[
              { val: plan1, set: setPlan1, n: 1 },
              { val: plan2, set: setPlan2, n: 2 },
              { val: plan3, set: setPlan3, n: 3 },
            ].map(({ val, set, n }) => (
              <div key={n} className="flex items-center gap-2">
                <span className="text-[10px] text-[#5A6B7A] w-4 text-right shrink-0">{n}.</span>
                <input
                  type="text"
                  value={val}
                  onChange={(e) => set(e.target.value)}
                  placeholder={`Plan item ${n}…`}
                  className="flex-1 h-7 bg-[#F4F1EB] border border-[#E8E4DC] rounded px-2 text-xs text-[#12354E] outline-none focus:border-[#064F6E] placeholder:text-[#5A6B7A]/60"
                />
              </div>
            ))}
          </div>
        </section>

        <div className="border-t border-[#E8E4DC]" />

        {/* Follow-up */}
        <section>
          <p className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium mb-1">
            Next Review Date
          </p>
          <input
            type="date"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            className="h-8 bg-[#F4F1EB] border border-[#E8E4DC] rounded-md px-2 text-xs text-[#12354E] outline-none focus:border-[#064F6E] w-full"
          />
        </section>
      </div>

      {/* Footer */}
      <div className="px-3 pb-2 pt-1.5 border-t border-[#E8E4DC] flex items-center justify-between shrink-0">
        <span className="text-[10px] text-[#5A6B7A]">Physician-edited</span>
        <span className="text-[10px] text-[#5A6B7A]">{timestamp}</span>
      </div>
    </div>
  )
}

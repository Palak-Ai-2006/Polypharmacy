"use client"

import { Badge } from "@/components/ui/badge"
import type { EnzymeData } from "@/lib/store"

const riskColors = {
  CRITICAL: { bg: "bg-[#C0392B]", text: "text-white", border: "border-l-[#C0392B]" },
  HIGH:     { bg: "bg-[#E67E22]", text: "text-white", border: "border-l-[#E67E22]" },
  MODERATE: { bg: "bg-[#F99D1B]", text: "text-[#12354E]", border: "border-l-[#F99D1B]" },
  LOW:      { bg: "bg-[#27AE60]", text: "text-white", border: "border-l-[#27AE60]" },
  NONE:     { bg: "bg-[#A7D4E4]", text: "text-[#12354E]", border: "border-l-[#A7D4E4]" },
}

const enzymeColors: Record<string, string> = {
  CYP3A4: "#064F6E",
  CYP2D6: "#F99D1B",
  CYP2C19: "#27AE60",
  CYP2C9: "#E67E22",
}

interface Props {
  enzymes: EnzymeData[]
}

export function EnzymeActivityAccordion({ enzymes }: Props) {
  if (!enzymes || enzymes.length === 0) return null

  return (
    <div className="mt-4 animate-section-2">
      <h3 className="text-xs uppercase tracking-wider text-[#5A6B7A] font-medium mb-2">Enzyme Activity</h3>
      <div className="flex flex-col gap-1.5">
        {enzymes.map((enzyme) => (
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
                    {enzyme.phenoconversion.from} &rarr; {enzyme.phenoconversion.to}
                  </span>
                )}
              </div>
              <Badge className={`${riskColors[enzyme.riskLevel].bg} ${riskColors[enzyme.riskLevel].text} text-[10px]`}>
                {enzyme.riskLevel}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1">
              {[
                ...(enzyme.substrates ?? []).map((d) => ({ name: d, role: "substrate" as const })),
                ...(enzyme.inhibitors ?? []).map((d) => ({ name: d, role: "inhibitor" as const })),
                ...(enzyme.inducers ?? []).map((d) => ({ name: d, role: "inducer" as const })),
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
  )
}

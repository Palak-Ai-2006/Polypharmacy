"use client"

import { Dna } from "lucide-react"

interface AppHeaderProps {
  showBack?: boolean
  onBack?: () => void
}

export function AppHeader({ showBack, onBack }: AppHeaderProps) {
  return (
    <header className="h-10 min-h-10 bg-white border-b border-[#E8E4DC] flex items-center justify-between px-4 shrink-0 print:hidden">
      <div className="flex items-center gap-2">
        <Dna className="h-5 w-5 text-[#064F6E]" />
        <span className="text-lg font-bold text-[#12354E]">Argus</span>
        <span className="text-[#E8E4DC]">&middot;</span>
        <span className="text-xs text-[#5A6B7A]">Clinical Interaction Analyzer</span>
        {showBack && (
          <>
            <span className="text-[#E8E4DC] ml-2">&middot;</span>
            <button
              onClick={onBack}
              className="text-xs text-[#5A6B7A] hover:text-[#064F6E] ml-1"
            >
              &larr; Patients
            </button>
          </>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#5A6B7A] font-medium">
            FOR RESEARCH USE ONLY
          </span>
        </div>
      </div>
    </header>
  )
}

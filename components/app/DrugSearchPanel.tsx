"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Search, X, Loader2, Stethoscope, CircleUser } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { usePolyPGxStore, type Drug } from "@/lib/store"

export function DrugSearchPanel() {
  const {
    selectedDrugs, addDrug: storeAddDrug, removeDrug: storeRemoveDrug,
    primaryDocName, primaryDocSpecialty, primaryDocHospital, primaryDocPhone,
    providerName, providerDept, sessionStart,
  } = usePolyPGxStore()

  const [drugSearch, setDrugSearch] = useState("")
  const [searchResults, setSearchResults] = useState<Drug[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [addedDrug, setAddedDrug] = useState<string | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const drugSearchInputRef = useRef<HTMLInputElement>(null)

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

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        drugSearchInputRef.current?.focus()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleAddDrug = useCallback((drug: Drug) => {
    storeAddDrug(drug)
    setAddedDrug(drug.rxcui)
    setTimeout(() => setAddedDrug(null), 150)
    setDrugSearch("")
    setShowDropdown(false)
    toast.success(`Added ${drug.name}`)
  }, [storeAddDrug])

  const handleRemoveDrug = useCallback((rxcui: string) => {
    const name = storeRemoveDrug(rxcui)
    if (name) toast(`Removed ${name}`)
  }, [storeRemoveDrug])

  return (
    <div className="w-[260px] min-w-[260px] border-r border-[#E8E4DC] flex flex-col bg-white">
      <div className="flex-1 flex flex-col p-3 overflow-hidden">
        {/* Title */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#12354E]">Medications</span>
          {selectedDrugs.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-[#064F6E] text-white text-[10px] flex items-center justify-center">
              {selectedDrugs.length}
            </span>
          )}
        </div>

        {/* Search */}
        <div className="relative mt-2" ref={searchRef}>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#5A6B7A]" />
            <Input
              ref={drugSearchInputRef}
              value={drugSearch}
              onChange={(e) => setDrugSearch(e.target.value)}
              placeholder="Search drugs..."
              className="h-8 text-sm pl-7 pr-8 border-[#E8E4DC] rounded-md focus:ring-[#064F6E] focus:border-[#064F6E]"
            />
            {isSearching && (
              <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#5A6B7A] animate-spin" />
            )}
          </div>

          {showDropdown && searchResults.length > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-[#E8E4DC] rounded-md shadow-lg max-h-36 overflow-y-auto">
              {searchResults.map((drug) => (
                <button
                  key={drug.rxcui}
                  onClick={() => handleAddDrug(drug)}
                  className="w-full px-2.5 py-1.5 text-left text-sm text-[#12354E] hover:bg-[#F4F1EB] cursor-pointer"
                >
                  {drug.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Drug list */}
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
                    onClick={() => handleRemoveDrug(drug.rxcui)}
                    className="opacity-0 group-hover:opacity-100 text-[#5A6B7A] hover:text-[#C0392B] shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with medication count + primary doc */}
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

      {/* Session indicator */}
      <div className="bg-[#F4F1EB] px-3 py-2.5 flex items-start gap-2.5 border-t border-[#E8E4DC]">
        <div className="w-8 h-8 rounded-full bg-white border border-[#E8E4DC] flex items-center justify-center shrink-0 mt-0.5">
          <CircleUser className="w-5 h-5 text-[#064F6E]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[#12354E] leading-tight">{providerName}</div>
          <div className="text-[10px] text-[#5A6B7A] mt-0.5">{providerDept}</div>
          <div className="flex items-center gap-1 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#27AE60] shrink-0" />
            <span className="text-[10px] text-[#5A6B7A]">Active &middot; {sessionStart}</span>
          </div>
        </div>
        <button className="text-[10px] text-[#5A6B7A] underline cursor-pointer shrink-0 mt-0.5">Sign Out</button>
      </div>
    </div>
  )
}

"use client"

import { useMemo } from "react"
import { AlertTriangle, Info, BookOpen } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { usePolyPGxStore } from "@/lib/store"
import { EnzymeActivityAccordion } from "./EnzymeActivityAccordion"
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion"

const riskColors = {
  CRITICAL: { bg: "bg-[#C0392B]", text: "text-white", border: "border-l-[#C0392B]", light: "bg-[#C0392B]/5" },
  HIGH:     { bg: "bg-[#E67E22]", text: "text-white", border: "border-l-[#E67E22]", light: "bg-[#E67E22]/5" },
  MODERATE: { bg: "bg-[#F99D1B]", text: "text-[#12354E]", border: "border-l-[#F99D1B]", light: "bg-[#F99D1B]/5" },
  LOW:      { bg: "bg-[#27AE60]", text: "text-white", border: "border-l-[#27AE60]", light: "bg-[#27AE60]/5" },
  NONE:     { bg: "bg-[#A7D4E4]", text: "text-[#12354E]", border: "border-l-[#A7D4E4]", light: "bg-[#A7D4E4]/5" },
}

const RISK_ORDER = { CRITICAL: 0, HIGH: 1, MODERATE: 2, LOW: 3 } as const

export function AnalysisResultsPanel() {
  const {
    isAnalyzing, showAnalysis, analysisResult, analysisError,
    unmatchedDrugs, aiSources, aiRecommendations, streamingReasoning, collisionsReady,
    rawCollisionMap, ragContext,
  } = usePolyPGxStore()

  const sortedDrugIssues = useMemo(() => {
    if (!analysisResult?.drugIssues) return []
    return [...analysisResult.drugIssues].sort(
      (a, b) => RISK_ORDER[a.riskLevel as keyof typeof RISK_ORDER] - RISK_ORDER[b.riskLevel as keyof typeof RISK_ORDER]
    )
  }, [analysisResult?.drugIssues])

  return (
    <div className="w-[58%] border border-[#E8E4DC] rounded-lg bg-[#FDFBF7] overflow-y-auto scrollbar-hide print:w-full print:border-0">
      {/* Error Banner */}
      {analysisError && (
        <div className="m-4 p-3 rounded-md bg-red-50 border border-red-200 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">Analysis Failed</p>
            <p className="text-xs text-red-600 mt-0.5">{analysisError}</p>
          </div>
        </div>
      )}

      {/* Unmatched Drugs Warning */}
      {unmatchedDrugs.length > 0 && (
        <div className="m-4 mb-0 p-3 rounded-md bg-amber-50 border border-amber-200 flex items-start gap-2">
          <Info className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">Unrecognized Medications</p>
            <p className="text-xs text-amber-600 mt-0.5">
              The following drugs are not in the CYP interaction database and were analyzed by AI only: {unmatchedDrugs.join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* Streaming: show collisions immediately while LLM works */}
      {isAnalyzing && collisionsReady && analysisResult && (
        <div className="p-4">
          {/* Risk Banner (from collisions) */}
          <div className={`rounded-md p-3 border-l-[3px] ${riskColors[analysisResult.overallRisk].border} ${riskColors[analysisResult.overallRisk].light}`}>
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-[#12354E] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <Badge className={`${riskColors[analysisResult.overallRisk].bg} ${riskColors[analysisResult.overallRisk].text} text-xs mb-1`}>
                  {analysisResult.overallRisk}
                </Badge>
                <p className="text-sm leading-snug text-[#12354E]">
                  {analysisResult.summary || "Collision data ready. Waiting for AI reasoning..."}
                </p>
              </div>
            </div>
          </div>

          {/* Enzyme Activity (instant from collision engine) */}
          <EnzymeActivityAccordion enzymes={analysisResult.enzymeActivity} />

          {/* Streaming reasoning indicator */}
          {streamingReasoning && (
            <div className="mt-4 p-3 rounded-md bg-[#064F6E]/5 border border-[#064F6E]/10">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-[#064F6E] animate-pulse" />
                <span className="text-[10px] uppercase tracking-wider text-[#5A6B7A] font-medium">AI Reasoning</span>
              </div>
              <p className="text-xs text-[#12354E] leading-relaxed">{streamingReasoning}</p>
            </div>
          )}

          {/* Skeleton for remaining LLM sections */}
          <div className="mt-4 space-y-2">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-14 w-full rounded-md" />
          </div>
        </div>
      )}

      {/* Skeleton: no collision data yet */}
      {isAnalyzing && !collisionsReady && (
        <div className="p-4 space-y-4 animate-in fade-in">
          <Skeleton className="h-20 w-full rounded-md" />
          <Skeleton className="h-6 w-48" />
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
          <Skeleton className="h-6 w-36" />
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-14 w-full rounded-md" />
          </div>
        </div>
      )}

      {/* Full results after streaming is complete */}
      {showAnalysis && analysisResult && !isAnalyzing && (
        <div className="p-4">
          {/* Risk Banner */}
          <div className={`rounded-md p-3 border-l-[3px] ${riskColors[analysisResult.overallRisk].border} ${riskColors[analysisResult.overallRisk].light} animate-section-1`}>
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
          <EnzymeActivityAccordion enzymes={analysisResult.enzymeActivity} />

          {/* Drug Interactions */}
          {sortedDrugIssues.length > 0 && (
            <div className="mt-4 animate-section-3">
              <h3 className="text-xs uppercase tracking-wider text-[#5A6B7A] font-medium mb-2">Interactions</h3>
              <Accordion type="multiple" className="flex flex-col gap-1.5">
                {sortedDrugIssues.map((issue, idx) => (
                  <AccordionItem
                    key={idx}
                    value={`issue-${idx}`}
                    className={`border rounded-md bg-white border-l-[3px] ${riskColors[issue.riskLevel as keyof typeof riskColors].border}`}
                  >
                    <AccordionTrigger className="py-2 px-3 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#12354E]">{issue.drug}</span>
                        <Badge className={`${riskColors[issue.riskLevel as keyof typeof riskColors].bg} ${riskColors[issue.riskLevel as keyof typeof riskColors].text} text-[10px]`}>
                          {issue.riskLevel}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="py-2 px-3">
                      <div className="space-y-2 text-xs leading-relaxed text-[#5A6B7A]">
                        <p><span className="font-medium text-[#12354E]">Issue:</span> {issue.issue}</p>
                        <p><span className="font-medium text-[#12354E]">Mechanism:</span> {issue.mechanism}</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}

          {/* AI Sources & Recommendations */}
          {(aiSources.length > 0 || aiRecommendations.length > 0) && (
            <div className="mt-4 animate-section-4">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-4 w-4 text-[#064F6E]" />
                <span className="text-xs font-semibold text-[#12354E]">AI Sources & Recommendations</span>
              </div>
              {aiRecommendations.length > 0 && (
                <ul className="space-y-1 mb-3">
                  {aiRecommendations.map((rec, i) => (
                    <li key={i} className="text-xs text-[#12354E] pl-3 border-l-2 border-[#A7D4E4]">{rec}</li>
                  ))}
                </ul>
              )}
              {aiSources.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {aiSources.map((src, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-[#F4F1EB] text-[#5A6B7A]">{src}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* AI Reasoning Trace */}
          {rawCollisionMap != null && (
            <details className="mt-4 text-xs text-gray-500">
              <summary className="cursor-pointer font-medium select-none hover:text-gray-700">
                🔍 View AI Reasoning Trace
              </summary>
              <div className="mt-2 space-y-3">
                <div>
                  <p className="font-medium text-gray-600 mb-1">Collision Map (deterministic engine)</p>
                  <pre className="bg-gray-100 p-3 rounded overflow-auto max-h-64 text-[10px] leading-relaxed">
                    {JSON.stringify(rawCollisionMap, null, 2)}
                  </pre>
                </div>
                {ragContext && (
                  <div>
                    <p className="font-medium text-gray-600 mb-1">RAG Context (retrieved chunks)</p>
                    <pre className="bg-gray-100 p-3 rounded overflow-auto max-h-64 text-[10px] leading-relaxed whitespace-pre-wrap">
                      {ragContext}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          )}

          {/* Sources footnote */}
          <div className="mt-6 text-center animate-section-4">
            <span className="text-[10px] text-[#5A6B7A]">
              Sources: PharmGKB &middot; CPIC Guidelines &middot; FDA Drug Interaction Tables &middot; DrugBank
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

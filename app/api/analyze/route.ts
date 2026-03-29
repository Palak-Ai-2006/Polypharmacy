import { NextRequest } from "next/server"
import { detectCollisions } from "@/lib/collision-detector"
import { runLLMAnalysis } from "@/lib/rag-chain"
import { fetchOpenFDABatch } from "@/lib/openfda"
import { retrieveRAGContext } from "@/lib/retriever"
import { logEnvironmentCheck } from "@/lib/env-check"
import { calculateSeverityScore } from "@/lib/severity-scorer"
import type { PatientInput, MetabolizerPhenotype, OpenFDADrugInfo } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// Validate environment on first import (server startup)
logEnvironmentCheck();

function normalizePhenotype(val: string): MetabolizerPhenotype {
  const map: Record<string, MetabolizerPhenotype> = {
    "ultra-rapid": "ultrarapid",
    ultrarapid: "ultrarapid",
  }
  const lower = val.toLowerCase()
  return (map[lower] ?? lower) as MetabolizerPhenotype
}

function buildOpenFDAContext(data: OpenFDADrugInfo[]): string {
  const lines = data
    .filter((d) => d.warnings.length || d.drugInteractions.length)
    .map((d) => {
      const parts = [`Drug: ${d.drugName}`]
      if (d.warnings.length) parts.push(`  Warnings: ${d.warnings.join(" | ")}`)
      if (d.drugInteractions.length) parts.push(`  Interactions: ${d.drugInteractions.join(" | ")}`)
      return parts.join("\n")
    })
  return lines.length ? `## FDA Drug Safety Data\n${lines.join("\n\n")}` : ""
}

/**
 * SSE streaming endpoint.
 * Event types:
 *   "collisions" - deterministic collision data (instant)
 *   "analysis"   - full LLM analysis result
 *   "reasoning"  - streaming reasoning chunks (future: token-level)
 *   "error"      - error message
 *   "done"       - stream complete
 */
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const { patient } = await request.json()

        if (!patient?.drugs?.length) {
          send("error", { error: "At least one drug is required" })
          controller.close()
          return
        }

        const patientInput: PatientInput = {
          name: patient.name,
          age: patient.age,
          drugs: patient.drugs,
          geneticProfile: {
            CYP3A4: normalizePhenotype(patient.geneticProfile?.CYP3A4 ?? "normal"),
            CYP2D6: normalizePhenotype(patient.geneticProfile?.CYP2D6 ?? "normal"),
            CYP2C19: normalizePhenotype(patient.geneticProfile?.CYP2C19 ?? "normal"),
            CYP2C9: normalizePhenotype(patient.geneticProfile?.CYP2C9 ?? "normal"),
          },
        }

        // Layer 2: deterministic collision detection (instant, < 5ms)
        const collisionMap = detectCollisions(patientInput)
        const severityScore = calculateSeverityScore(patientInput, collisionMap)

        const phenoconversions = collisionMap.phenoconversions.map((p) => ({
          enzyme: p.enzyme,
          from: p.originalPhenotype,
          to: p.effectivePhenotype,
        }))

        // Send collision results immediately
        send("collisions", {
          collisions: collisionMap.collisions,
          phenoconversions,
          overallRisk: collisionMap.overallRisk,
          unmatchedDrugs: collisionMap.unmatchedDrugs,
          severityScore,
        })

        // Layer 3: RAG + OpenFDA (parallel, skip on failure)
        const drugNames = (patient.drugs as string[])
        const [fdaData, ragContext] = await Promise.all([
          fetchOpenFDABatch(drugNames),
          retrieveRAGContext(drugNames),
        ])
        const openfdaContext = buildOpenFDAContext(fdaData)
        const combinedContext = [ragContext, openfdaContext].filter(Boolean).join("\n\n")

        // Send reasoning start indicator
        send("reasoning", { chunk: "Analyzing with clinical guidelines..." })

        // Layer 4: Gemini reasoning
        const analysis = await runLLMAnalysis(patientInput, collisionMap, combinedContext)

        // Send full analysis
        send("analysis", {
          overallRiskLevel: analysis.overallRiskLevel,
          summary: analysis.summary,
          drugIssues: analysis.drugIssues,
          clinicalNote: analysis.clinicalNote,
          recommendations: analysis.recommendations,
          sources: analysis.sources,
          disclaimer: analysis.disclaimer,
          ragContext: combinedContext || null,
        })

        send("done", {})
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        console.error("[PolyPGx] /api/analyze SSE failed:", message)
        send("error", { error: `Analysis failed: ${message}` })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}

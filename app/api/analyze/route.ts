import { NextRequest, NextResponse } from "next/server"
import { detectCollisions } from "@/lib/collision-detector"
import { runLLMAnalysis } from "@/lib/rag-chain"
import type { PatientInput, MetabolizerPhenotype } from "@/lib/types"

function normalizePhenotype(val: string): MetabolizerPhenotype {
  // UI sends "Normal", "Poor", "Ultra-rapid" etc — lib expects lowercase
  const map: Record<string, MetabolizerPhenotype> = {
    "ultra-rapid": "ultrarapid",
    ultrarapid: "ultrarapid",
  }
  const lower = val.toLowerCase()
  return (map[lower] ?? lower) as MetabolizerPhenotype
}

export async function POST(request: NextRequest) {
  try {
    const { patient } = await request.json()

    if (!patient?.drugs?.length) {
      return NextResponse.json({ error: "At least one drug is required" }, { status: 400 })
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

    // Layer 2: deterministic collision detection
    const collisionMap = detectCollisions(patientInput)

    // Layer 4: Gemini reasoning (graceful fallback if no API key)
    const analysis = await runLLMAnalysis(patientInput, collisionMap)

    // Map PhenoconversionEvent fields → {from, to} that page.tsx expects
    const phenoconversions = collisionMap.phenoconversions.map((p) => ({
      enzyme: p.enzyme,
      from: p.originalPhenotype,
      to: p.effectivePhenotype,
    }))

    return NextResponse.json({
      collisionMap: {
        collisions: collisionMap.collisions,
        phenoconversions,
        overallRisk: collisionMap.overallRisk,
      },
      analysis: {
        overallRiskLevel: analysis.overallRiskLevel,
        summary: analysis.summary,
        drugIssues: analysis.drugIssues,
        clinicalNote: analysis.clinicalNote,
        recommendations: analysis.recommendations,
        sources: analysis.sources,
        disclaimer: analysis.disclaimer,
      },
    })
  } catch {
    return NextResponse.json({ error: "Failed to analyze interactions" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { detectCollisions } from "@/lib/collision-detector"
import { runLLMAnalysis } from "@/lib/rag-chain"
import { retrieveRAGContext } from "@/lib/retriever"
import type { AnalyzeRequest, AnalyzeResponse, PatientInput } from "@/lib/types"

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequest = await request.json()
    const { patient } = body
    patient.drugs = patient.drugs.map(d => d.toLowerCase().trim())

    if (!patient?.drugs || patient.drugs.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one drug is required" },
        { status: 400 }
      )
    }

    if (!patient.geneticProfile) {
      return NextResponse.json(
        { success: false, error: "Genetic profile is required" },
        { status: 400 }
      )
    }

    // Layer 2: Deterministic collision detection (pure logic, no AI)
    const collisionMap = detectCollisions(patient as PatientInput)

    // Layer 3: RAG retrieval from ChromaDB
    const ragContext = await retrieveRAGContext(patient.drugs)

    // Layer 4: Gemini reasoning on top of collision data + RAG
    const analysis = await runLLMAnalysis(patient as PatientInput, collisionMap, ragContext)

    const response: AnalyzeResponse = {
      success: true,
      collisionMap,
      analysis,
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Analysis failed:", error)
    return NextResponse.json(
      { success: false, error: "Analysis failed. Please try again." },
      { status: 500 }
    )
  }
}
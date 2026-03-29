// ============================================================
// PDF DNA Report Parser
// Accepts a report URL (from /public/reports/), fetches it
// server-side, and uses Gemini multimodal to extract CYP
// metabolizer phenotypes.
// ============================================================

import { NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

const PROMPT = `You are parsing a pharmacogenomics lab report (e.g., GeneSight, OneOme, Genomind, Invitae).
Extract the metabolizer phenotype for these four CYP enzymes: CYP3A4, CYP2D6, CYP2C19, CYP2C9.

Map any phenotype language to one of these exact values:
- "Poor" (poor metabolizer, PM, decreased function)
- "Intermediate" (intermediate metabolizer, IM, reduced function)
- "Normal" (normal/extensive metabolizer, EM, NM)
- "Rapid" (rapid metabolizer, RM)
- "Ultra-rapid" (ultrarapid metabolizer, UM)
- "Unknown" (not tested, not reported, or not found)

Return ONLY valid JSON with exactly these four keys:
{"CYP3A4":"Normal","CYP2D6":"Poor","CYP2C19":"Intermediate","CYP2C9":"Normal"}

If an enzyme is not mentioned in the report, use "Unknown". No other text.`

export async function POST(request: NextRequest) {
  try {
    const { reportUrl } = await request.json()

    if (!reportUrl || typeof reportUrl !== "string") {
      return NextResponse.json({ error: "reportUrl is required" }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 })
    }

    // Fetch the PDF from /public/reports/ (served as a static asset)
    const origin = request.nextUrl.origin
    const pdfRes = await fetch(`${origin}${reportUrl}`)
    if (!pdfRes.ok) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    const buffer = await pdfRes.arrayBuffer()
    const base64 = Buffer.from(buffer).toString("base64")

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

    const result = await model.generateContent([
      { inlineData: { mimeType: "application/pdf", data: base64 } },
      PROMPT,
    ])

    const text = result.response.text()

    // Extract outermost JSON object with brace counting
    const start = text.indexOf("{")
    let jsonStr: string | null = null
    if (start !== -1) {
      let depth = 0
      for (let i = start; i < text.length; i++) {
        if (text[i] === "{") depth++
        else if (text[i] === "}") {
          if (--depth === 0) { jsonStr = text.slice(start, i + 1); break }
        }
      }
    }

    if (!jsonStr) {
      console.error("Gemini did not return valid JSON for PDF parse:", text)
      return NextResponse.json({ error: "Could not extract phenotypes from report" }, { status: 422 })
    }

    return NextResponse.json(JSON.parse(jsonStr))
  } catch {
    return NextResponse.json({ error: "Failed to parse report" }, { status: 500 })
  }
}

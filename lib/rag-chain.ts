// ============================================================
// Layer 4: LLM Reasoning via LangChain + Gemini
// Uses @langchain/google-genai for structured clinical reasoning.
// ============================================================

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type {
  CollisionMap,
  PatientInput,
  LLMAnalysisResult,
} from "./types";

const DISCLAIMER =
  "This analysis is for research and educational purposes only. " +
  "It is NOT intended for clinical use. Always consult a qualified " +
  "healthcare professional before making medication decisions.";

const SYSTEM_PROMPT = `You are a clinical pharmacogenomics reasoning engine.

You will receive:
1. A patient's medication list
2. CYP enzyme collision data (deterministic — already computed)
3. The patient's genetic metabolizer profile
4. (When available) Retrieved PharmGKB documents and CPIC guidelines

Your job:
- Reason through ALL simultaneous drug-gene interactions. Do NOT analyze each drug in isolation.
- Identify which enzyme is the "bottleneck" — the most overloaded or dangerous pathway.
- Explain the mechanism: which drug is the inhibitor/inducer, which is the victim substrate, and what happens clinically.
- Provide concrete recommendations (alternative drugs, dose adjustments, monitoring).
- Cite sources when possible (CPIC guideline, PharmGKB annotation).
- Generate a structured "Assessment and Plan" clinical note that a hospitalist could paste into the EHR.

Output ONLY valid JSON matching this exact structure:
{
  "overallRiskLevel": "CRITICAL" | "HIGH" | "MODERATE" | "LOW" | "NONE",
  "summary": "2-3 sentence executive summary",
  "bottleneckEnzymes": ["CYP2D6"],
  "drugIssues": [
    {
      "drug": "drug name",
      "riskLevel": "HIGH",
      "issue": "what's wrong",
      "mechanism": "enzyme + phenotype explanation",
      "recommendation": "what to do"
    }
  ],
  "clinicalNote": "Assessment:\\n...\\n\\nPlan:\\n...",
  "recommendations": ["actionable suggestion 1", "..."],
  "sources": ["CPIC guideline for ...", "PharmGKB annotation ..."]
}`;

/**
 * Calls Gemini via LangChain with collision data + patient info.
 * Returns structured analysis.
 */
export async function runLLMAnalysis(
  patient: PatientInput,
  collisionMap: CollisionMap,
  ragContext?: string
): Promise<LLMAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return buildFallbackAnalysis(collisionMap, "GEMINI_API_KEY not set");
  }

  // Try models in order — fall through on quota/rate-limit errors only
  const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash-lite", "gemini-2.0-flash-001"];
  const userMessage = buildUserMessage(patient, collisionMap, ragContext);
  let lastError = "";

  for (const modelName of MODELS) {
    try {
      const model = new ChatGoogleGenerativeAI({ model: modelName, apiKey, temperature: 0 });

      const response = await model.invoke([
        new SystemMessage(SYSTEM_PROMPT),
        new HumanMessage(userMessage),
      ]);

      const text = typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

      // Extract the outermost JSON object using brace counting
      const start = text.indexOf("{");
      let jsonStr: string | null = null;
      if (start !== -1) {
        let depth = 0;
        for (let i = start; i < text.length; i++) {
          if (text[i] === "{") depth++;
          else if (text[i] === "}") {
            if (--depth === 0) { jsonStr = text.slice(start, i + 1); break; }
          }
        }
      }
      if (!jsonStr) {
        console.error("LLM did not return valid JSON:", text);
        return buildFallbackAnalysis(collisionMap, "Model returned non-JSON response");
      }

      const parsed = JSON.parse(jsonStr) as LLMAnalysisResult;
      parsed.disclaimer = DISCLAIMER;
      return parsed;

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      lastError = msg.slice(0, 200);
      console.error(`LLM call failed [${modelName}]:`, msg.slice(0, 300));

      // Only fall through to next model on quota/rate-limit/overload
      // Stop immediately on auth errors (400) — no point trying more models
      if (msg.includes("400") || msg.includes("API_KEY_INVALID") || msg.includes("expired")) {
        return buildFallbackAnalysis(collisionMap, "API key invalid or expired — get a new key from aistudio.google.com");
      }
      // 429 quota or 503 overload → try next model
      if (msg.includes("429") || msg.includes("503") || msg.includes("quota")) continue;

      // Unknown error — stop
      return buildFallbackAnalysis(collisionMap, lastError);
    }
  }

  return buildFallbackAnalysis(collisionMap, `All models quota-exhausted. Last error: ${lastError}`);
}

function buildUserMessage(
  patient: PatientInput,
  collisionMap: CollisionMap,
  ragContext?: string
): string {
  const parts: string[] = [
    `## Patient Profile`,
    `- Age: ${patient.age ?? "unknown"}`,
    `- Medications: ${patient.drugs.join(", ")}`,
    `- Genetic Profile:`,
    `  - CYP3A4: ${patient.geneticProfile.CYP3A4}`,
    `  - CYP2D6: ${patient.geneticProfile.CYP2D6}`,
    `  - CYP2C19: ${patient.geneticProfile.CYP2C19}`,
    `  - CYP2C9: ${patient.geneticProfile.CYP2C9}`,
    ``,
    `## CYP Collision Data (Deterministic — Ground Truth)`,
    `Overall Risk: ${collisionMap.overallRisk}`,
  ];

  for (const c of collisionMap.collisions) {
    parts.push(`\n### ${c.enzyme} — Risk: ${c.riskLevel}`);
    if (c.substrates.length) parts.push(`  Substrates: ${c.substrates.join(", ")}`);
    if (c.inhibitors.length) parts.push(`  Inhibitors: ${c.inhibitors.join(", ")}`);
    if (c.inducers.length) parts.push(`  Inducers: ${c.inducers.join(", ")}`);
    parts.push(`  Reason: ${c.riskReason}`);
  }

  if (collisionMap.phenoconversions.length > 0) {
    parts.push(`\n## Phenoconversion Events`);
    for (const p of collisionMap.phenoconversions) {
      parts.push(`- ${p.enzyme}: ${p.originalPhenotype} → ${p.effectivePhenotype} (caused by ${p.causedBy})`);
    }
  }

  if (collisionMap.unmatchedDrugs.length > 0) {
    parts.push(`\n## Unmatched Drugs (not in our database)`);
    parts.push(collisionMap.unmatchedDrugs.join(", "));
  }

  if (ragContext) {
    parts.push(`\n## Retrieved Clinical Evidence`);
    parts.push(ragContext);
  }

  return parts.join("\n");
}

function buildFallbackAnalysis(collisionMap: CollisionMap, reason?: string): LLMAnalysisResult {
  const issues = collisionMap.collisions
    .filter((c) => c.riskLevel !== "NONE")
    .map((c) => ({
      drug: c.substrates[0]?.replace(/ \(.*\)/, "") ?? "unknown",
      riskLevel: c.riskLevel,
      issue: c.riskReason,
      mechanism: `${c.enzyme} collision: ${c.inhibitors.length} inhibitor(s), ${c.substrates.length} substrate(s)`,
      recommendation: "Consult a clinical pharmacist for review.",
    }));

  const n = collisionMap.collisions.filter((c) => c.riskLevel !== "NONE").length;
  return {
    overallRiskLevel: collisionMap.overallRisk,
    summary: reason
      ? `Detected ${n} collision(s). LLM unavailable — ${reason}`
      : `Detected ${n} collision(s). LLM analysis unavailable — showing deterministic results only.`,
    bottleneckEnzymes: collisionMap.collisions
      .filter((c) => c.riskLevel === "CRITICAL" || c.riskLevel === "HIGH")
      .map((c) => c.enzyme),
    drugIssues: issues,
    clinicalNote: "LLM unavailable. Please review collision data manually.",
    recommendations: ["Review flagged enzyme collisions with a clinical pharmacist."],
    sources: ["Deterministic CYP collision analysis (FDA CYP table)"],
    disclaimer: DISCLAIMER,
  };
}

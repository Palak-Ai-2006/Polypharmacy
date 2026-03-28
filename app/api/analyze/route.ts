import { NextRequest, NextResponse } from "next/server"

type MetabolizerStatus = "poor" | "intermediate" | "normal" | "rapid" | "ultrarapid" | "unknown"
type RiskLevel = "CRITICAL" | "HIGH" | "MODERATE" | "LOW" | "NONE"

interface GeneticProfile {
  CYP3A4: MetabolizerStatus
  CYP2D6: MetabolizerStatus
  CYP2C19: MetabolizerStatus
  CYP2C9: MetabolizerStatus
}

interface AnalyzeRequest {
  patient: {
    name?: string
    age?: number
    drugs: string[]
    geneticProfile: GeneticProfile
  }
}

// Drug-enzyme interaction database
const DRUG_ENZYME_MAP: Record<string, { enzyme: string; role: "substrate" | "inhibitor" | "inducer" }[]> = {
  "Warfarin": [{ enzyme: "CYP2C9", role: "substrate" }, { enzyme: "CYP3A4", role: "substrate" }],
  "Clopidogrel": [{ enzyme: "CYP2C19", role: "substrate" }],
  "Omeprazole": [{ enzyme: "CYP2C19", role: "substrate" }, { enzyme: "CYP2C19", role: "inhibitor" }],
  "Fluoxetine": [{ enzyme: "CYP2D6", role: "inhibitor" }, { enzyme: "CYP2C19", role: "inhibitor" }],
  "Simvastatin": [{ enzyme: "CYP3A4", role: "substrate" }],
  "Atorvastatin": [{ enzyme: "CYP3A4", role: "substrate" }],
  "Amiodarone": [{ enzyme: "CYP2D6", role: "inhibitor" }, { enzyme: "CYP3A4", role: "inhibitor" }],
  "Carbamazepine": [{ enzyme: "CYP3A4", role: "inducer" }, { enzyme: "CYP2C9", role: "inducer" }],
  "Phenytoin": [{ enzyme: "CYP2C9", role: "substrate" }, { enzyme: "CYP3A4", role: "inducer" }],
  "Rifampin": [{ enzyme: "CYP3A4", role: "inducer" }, { enzyme: "CYP2C9", role: "inducer" }, { enzyme: "CYP2C19", role: "inducer" }],
  "Ketoconazole": [{ enzyme: "CYP3A4", role: "inhibitor" }],
  "Itraconazole": [{ enzyme: "CYP3A4", role: "inhibitor" }],
  "Clarithromycin": [{ enzyme: "CYP3A4", role: "inhibitor" }],
  "Erythromycin": [{ enzyme: "CYP3A4", role: "inhibitor" }],
  "Metoprolol": [{ enzyme: "CYP2D6", role: "substrate" }],
  "Codeine": [{ enzyme: "CYP2D6", role: "substrate" }],
  "Tramadol": [{ enzyme: "CYP2D6", role: "substrate" }],
  "Oxycodone": [{ enzyme: "CYP2D6", role: "substrate" }, { enzyme: "CYP3A4", role: "substrate" }],
  "Hydrocodone": [{ enzyme: "CYP2D6", role: "substrate" }],
  "Paroxetine": [{ enzyme: "CYP2D6", role: "inhibitor" }],
  "Sertraline": [{ enzyme: "CYP2D6", role: "inhibitor" }],
  "Bupropion": [{ enzyme: "CYP2D6", role: "inhibitor" }],
  "Duloxetine": [{ enzyme: "CYP2D6", role: "inhibitor" }],
  "Venlafaxine": [{ enzyme: "CYP2D6", role: "substrate" }],
  "Citalopram": [{ enzyme: "CYP2C19", role: "substrate" }],
  "Escitalopram": [{ enzyme: "CYP2C19", role: "substrate" }],
  "Methadone": [{ enzyme: "CYP2D6", role: "substrate" }, { enzyme: "CYP3A4", role: "substrate" }],
  "Fentanyl": [{ enzyme: "CYP3A4", role: "substrate" }],
  "Morphine": [{ enzyme: "CYP2D6", role: "substrate" }],
  "Tamoxifen": [{ enzyme: "CYP2D6", role: "substrate" }],
  "Losartan": [{ enzyme: "CYP2C9", role: "substrate" }],
  "Voriconazole": [{ enzyme: "CYP2C19", role: "substrate" }, { enzyme: "CYP3A4", role: "inhibitor" }],
  "Fluconazole": [{ enzyme: "CYP2C19", role: "inhibitor" }, { enzyme: "CYP3A4", role: "inhibitor" }],
  "Diltiazem": [{ enzyme: "CYP3A4", role: "inhibitor" }],
  "Verapamil": [{ enzyme: "CYP3A4", role: "inhibitor" }],
  "Cyclosporine": [{ enzyme: "CYP3A4", role: "substrate" }],
  "Tacrolimus": [{ enzyme: "CYP3A4", role: "substrate" }],
  "Ritonavir": [{ enzyme: "CYP3A4", role: "inhibitor" }, { enzyme: "CYP2D6", role: "inhibitor" }],
  "Grapefruit juice": [{ enzyme: "CYP3A4", role: "inhibitor" }],
  "St. John's Wort": [{ enzyme: "CYP3A4", role: "inducer" }, { enzyme: "CYP2C9", role: "inducer" }],
}

function analyzeInteractions(drugs: string[], geneticProfile: GeneticProfile) {
  const enzymes = ["CYP3A4", "CYP2D6", "CYP2C19", "CYP2C9"] as const
  const collisions: {
    enzyme: string
    drugs: { name: string; role: "substrate" | "inhibitor" | "inducer" }[]
    riskLevel: RiskLevel
  }[] = []
  const phenoconversions: { enzyme: string; from: string; to: string }[] = []
  const drugIssues: {
    drug: string
    riskLevel: RiskLevel
    issue: string
    mechanism: string
    recommendation: string
  }[] = []

  // Build enzyme collision map
  for (const enzyme of enzymes) {
    const enzymeData: { name: string; role: "substrate" | "inhibitor" | "inducer" }[] = []

    for (const drug of drugs) {
      const interactions = DRUG_ENZYME_MAP[drug] || []
      for (const interaction of interactions) {
        if (interaction.enzyme === enzyme) {
          enzymeData.push({ name: drug, role: interaction.role })
        }
      }
    }

    if (enzymeData.length > 0) {
      const hasSubstrate = enzymeData.some(d => d.role === "substrate")
      const hasInhibitor = enzymeData.some(d => d.role === "inhibitor")
      const hasInducer = enzymeData.some(d => d.role === "inducer")
      const metabolizerStatus = geneticProfile[enzyme as keyof GeneticProfile]

      let riskLevel: RiskLevel = "NONE"

      if (hasSubstrate && hasInhibitor) {
        if (metabolizerStatus === "poor") {
          riskLevel = "CRITICAL"
        } else if (metabolizerStatus === "intermediate") {
          riskLevel = "HIGH"
        } else {
          riskLevel = "MODERATE"
        }
      } else if (hasSubstrate && hasInducer) {
        if (metabolizerStatus === "ultrarapid" || metabolizerStatus === "rapid") {
          riskLevel = "HIGH"
        } else {
          riskLevel = "MODERATE"
        }
      } else if (enzymeData.length > 1 && hasSubstrate) {
        riskLevel = "LOW"
      }

      if (hasInhibitor && metabolizerStatus === "normal") {
        phenoconversions.push({ enzyme, from: "Normal", to: "Poor" })
      } else if (hasInducer && metabolizerStatus === "normal") {
        phenoconversions.push({ enzyme, from: "Normal", to: "Rapid" })
      }

      collisions.push({ enzyme, drugs: enzymeData, riskLevel })
    }
  }

  // Index collisions by enzyme for O(1) lookup
  const collisionByEnzyme = new Map(collisions.map(c => [c.enzyme, c]))

  // Generate drug-specific issues in a single pass per interaction
  const seen = new Set<string>()
  for (const drug of drugs) {
    for (const interaction of DRUG_ENZYME_MAP[drug] || []) {
      if (interaction.role !== "substrate") continue

      const collision = collisionByEnzyme.get(interaction.enzyme)
      const metabolizerStatus = geneticProfile[interaction.enzyme as keyof GeneticProfile]

      if (collision && collision.riskLevel !== "NONE" && collision.riskLevel !== "LOW") {
        const inhibitors = collision.drugs.filter(d => d.role === "inhibitor" && d.name !== drug)
        const inducers = collision.drugs.filter(d => d.role === "inducer" && d.name !== drug)

        if (inhibitors.length > 0) {
          drugIssues.push({
            drug,
            riskLevel: collision.riskLevel,
            issue: `${drug} metabolism may be inhibited by ${inhibitors.map(i => i.name).join(", ")}`,
            mechanism: `${drug} is metabolized by ${interaction.enzyme}. Co-administration with ${inhibitors.map(i => i.name).join(", ")} may decrease its metabolism, leading to increased drug levels and potential toxicity.`,
            recommendation: `Consider dose reduction of ${drug} or monitor closely for adverse effects. Alternative medications that don't interact with ${interaction.enzyme} may be considered.`
          })
        }

        if (inducers.length > 0) {
          drugIssues.push({
            drug,
            riskLevel: collision.riskLevel,
            issue: `${drug} metabolism may be increased by ${inducers.map(i => i.name).join(", ")}`,
            mechanism: `${drug} is metabolized by ${interaction.enzyme}. Co-administration with ${inducers.map(i => i.name).join(", ")} may increase its metabolism, leading to decreased drug levels and reduced efficacy.`,
            recommendation: `Consider dose increase of ${drug} or monitor for therapeutic response. Alternative medications may be considered.`
          })
        }
      }

      if (metabolizerStatus === "poor") {
        drugIssues.push({
          drug,
          riskLevel: "HIGH",
          issue: `Patient is a poor metabolizer for ${interaction.enzyme}`,
          mechanism: `As a poor metabolizer of ${interaction.enzyme}, the patient may have significantly reduced ability to metabolize ${drug}, leading to drug accumulation and increased risk of adverse effects.`,
          recommendation: `Consider starting at a lower dose or using an alternative medication that is not primarily metabolized by ${interaction.enzyme}.`
        })
      } else if (metabolizerStatus === "ultrarapid") {
        drugIssues.push({
          drug,
          riskLevel: "MODERATE",
          issue: `Patient is an ultra-rapid metabolizer for ${interaction.enzyme}`,
          mechanism: `As an ultra-rapid metabolizer of ${interaction.enzyme}, the patient may have increased clearance of ${drug}, potentially leading to subtherapeutic levels.`,
          recommendation: `Consider dose increase or more frequent dosing. Monitor therapeutic response closely.`
        })
      }
    }
  }

  const uniqueIssues = drugIssues.filter(issue => {
    const key = `${issue.drug}|${issue.issue}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const allRisks = [...collisions.map(c => c.riskLevel), ...uniqueIssues.map(i => i.riskLevel)]
  const overallRisk: RiskLevel = (["CRITICAL", "HIGH", "MODERATE", "LOW"] as RiskLevel[]).find(
    level => allRisks.includes(level)
  ) ?? "NONE"

  return { collisions, phenoconversions, overallRisk, drugIssues: uniqueIssues }
}

function generateClinicalNote(
  drugs: string[],
  analysis: ReturnType<typeof analyzeInteractions>,
  patientName?: string,
  patientAge?: number
): string {
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  })

  let note = `PHARMACOGENOMIC DRUG INTERACTION ANALYSIS
Date: ${date}
${patientName ? `Patient: ${patientName}` : ""}
${patientAge ? `Age: ${patientAge} years` : ""}

MEDICATIONS ANALYZED:
${drugs.map(d => `- ${d}`).join("\n")}

OVERALL RISK ASSESSMENT: ${analysis.overallRisk}

`

  if (analysis.phenoconversions.length > 0) {
    note += `PHENOCONVERSION ALERTS:
${analysis.phenoconversions.map(p => `- ${p.enzyme}: ${p.from} → ${p.to} (drug-induced)`).join("\n")}

`
  }

  if (analysis.drugIssues.length > 0) {
    note += `IDENTIFIED ISSUES:
${analysis.drugIssues.map(i => `- [${i.riskLevel}] ${i.issue}`).join("\n")}

RECOMMENDATIONS:
${analysis.drugIssues.map(i => `- ${i.recommendation}`).join("\n")}

`
  }

  note += `This analysis is for research purposes only and should be verified by a qualified healthcare professional before making clinical decisions.`

  return note
}

function generateSummary(analysis: ReturnType<typeof analyzeInteractions>): string {
  if (analysis.overallRisk === "NONE") {
    return "No significant drug-drug or drug-gene interactions were identified in this medication regimen. Standard monitoring is recommended."
  }

  const criticalCount = analysis.drugIssues.filter(i => i.riskLevel === "CRITICAL").length
  const highCount = analysis.drugIssues.filter(i => i.riskLevel === "HIGH").length
  const phenoCount = analysis.phenoconversions.length

  let summary = ""

  if (analysis.overallRisk === "CRITICAL") {
    summary = `CRITICAL interactions detected. ${criticalCount} critical issue(s) require immediate attention. `
  } else if (analysis.overallRisk === "HIGH") {
    summary = `High-risk interactions identified. ${highCount} significant issue(s) may require intervention. `
  } else if (analysis.overallRisk === "MODERATE") {
    summary = `Moderate interactions detected that may affect drug efficacy or safety. `
  } else {
    summary = `Minor interactions detected with low clinical significance. `
  }

  if (phenoCount > 0) {
    summary += `${phenoCount} potential phenoconversion event(s) identified that may alter drug metabolism.`
  }

  return summary
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequest = await request.json()
    const { patient } = body

    if (!patient.drugs || patient.drugs.length === 0) {
      return NextResponse.json(
        { error: "At least one drug is required" },
        { status: 400 }
      )
    }

    const analysis = analyzeInteractions(patient.drugs, patient.geneticProfile)
    const clinicalNote = generateClinicalNote(
      patient.drugs,
      analysis,
      patient.name,
      patient.age
    )
    const summary = generateSummary(analysis)

    return NextResponse.json({
      collisionMap: {
        collisions: analysis.collisions,
        phenoconversions: analysis.phenoconversions,
        overallRisk: analysis.overallRisk
      },
      analysis: {
        overallRiskLevel: analysis.overallRisk,
        summary,
        drugIssues: analysis.drugIssues,
        clinicalNote,
        recommendations: analysis.drugIssues.map(i => i.recommendation),
        sources: [
          "PharmGKB Clinical Annotations",
          "CPIC Guidelines",
          "FDA Drug Interaction Tables",
          "DrugBank Database"
        ],
        disclaimer: "This tool is for research and educational purposes only. It should not be used as a substitute for professional medical advice, diagnosis, or treatment. Always consult with a qualified healthcare provider before making any changes to medication regimens."
      }
    })
  } catch {
    return NextResponse.json(
      { error: "Failed to analyze interactions" },
      { status: 500 }
    )
  }
}

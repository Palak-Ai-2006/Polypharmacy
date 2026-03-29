// ============================================================
// RAG Ingestion Script — run ONCE to build the vector DB
// Usage: npx ts-node scripts/ingest.ts
// ============================================================

import { ChromaClient } from "chromadb";
import * as fs from "fs";
import * as path from "path";

const COLLECTION_NAME = "pharmgkb_cpic";

// Hardcoded CPIC + PharmGKB knowledge chunks
// These are clinically accurate summaries — add more as needed
const KNOWLEDGE_BASE = [
  {
    id: "cpic_cyp2d6_codeine",
    content: "CPIC Guideline: CYP2D6 and Codeine. Codeine is a prodrug requiring CYP2D6 to convert to morphine. Poor metabolizers receive no analgesia. Ultrarapid metabolizers risk life-threatening opioid toxicity. CPIC recommends avoiding codeine in both poor and ultrarapid metabolizers. Alternative: morphine (not CYP2D6 dependent).",
    source: "CPIC",
    drugs: "codeine",
    enzyme: "CYP2D6"
  },
  {
    id: "cpic_cyp2d6_tamoxifen",
    content: "CPIC Guideline: CYP2D6 and Tamoxifen. Tamoxifen requires CYP2D6-mediated conversion to endoxifen for anticancer efficacy. CYP2D6 poor metabolizers have significantly reduced endoxifen levels and worse outcomes. Strong CYP2D6 inhibitors (paroxetine, fluoxetine) should be avoided in breast cancer patients on tamoxifen. CPIC recommends aromatase inhibitors as alternative in postmenopausal women.",
    source: "CPIC",
    drugs: "tamoxifen",
    enzyme: "CYP2D6"
  },
  {
    id: "cpic_cyp2c19_clopidogrel",
    content: "CPIC Guideline: CYP2C19 and Clopidogrel. Clopidogrel is a prodrug requiring CYP2C19 activation. CYP2C19 poor metabolizers have significantly reduced antiplatelet effect and higher rates of major adverse cardiac events. Concomitant CYP2C19 inhibitors (omeprazole, esomeprazole) reduce active metabolite levels. CPIC recommends prasugrel or ticagrelor as alternatives for poor metabolizers.",
    source: "CPIC",
    drugs: "clopidogrel omeprazole esomeprazole",
    enzyme: "CYP2C19"
  },
  {
    id: "cpic_cyp2c9_warfarin",
    content: "CPIC Guideline: CYP2C9/VKORC1 and Warfarin. Warfarin S-enantiomer is a sensitive CYP2C9 substrate with narrow therapeutic index. CYP2C9 poor metabolizers require significantly lower doses to avoid bleeding. Fluconazole is a strong CYP2C9 inhibitor that dramatically increases warfarin exposure — INR must be monitored closely or fluconazole avoided. CPIC recommends dose reduction of 30-50% when adding a strong CYP2C9 inhibitor.",
    source: "CPIC",
    drugs: "warfarin fluconazole",
    enzyme: "CYP2C9"
  },
  {
    id: "pharmgkb_fluconazole_warfarin",
    content: "PharmGKB Annotation: Fluconazole + Warfarin interaction. Level 1A evidence. Fluconazole inhibits CYP2C9 strongly and CYP3A4 moderately. Co-administration with warfarin leads to INR increases of 50-100%. Multiple case reports of serious bleeding events. FDA labeling requires INR monitoring and warfarin dose adjustment when fluconazole is added.",
    source: "PharmGKB",
    drugs: "fluconazole warfarin",
    enzyme: "CYP2C9"
  },
  {
    id: "cpic_cyp2c19_ssri",
    content: "CPIC Guideline: CYP2C19 and SSRIs (citalopram, escitalopram). CYP2C19 poor metabolizers have 2-3x higher citalopram/escitalopram plasma levels, increasing QTc prolongation risk. FDA recommends maximum dose of 20mg citalopram in poor metabolizers. Omeprazole, a moderate CYP2C19 inhibitor, can further elevate SSRI levels in patients already on these medications.",
    source: "CPIC",
    drugs: "citalopram escitalopram omeprazole",
    enzyme: "CYP2C19"
  },
  {
    id: "pharmgkb_cyp3a4_statins",
    content: "PharmGKB Annotation: CYP3A4 inhibitors and statins (simvastatin, atorvastatin). Strong CYP3A4 inhibitors like clarithromycin dramatically increase statin exposure. Simvastatin + clarithromycin is contraindicated due to rhabdomyolysis risk. Atorvastatin requires dose reduction. FDA recommends avoiding simvastatin doses >20mg with moderate CYP3A4 inhibitors.",
    source: "PharmGKB",
    drugs: "simvastatin atorvastatin clarithromycin diltiazem",
    enzyme: "CYP3A4"
  },
  {
    id: "cpic_cyp2d6_antidepressants",
    content: "CPIC Guideline: CYP2D6 and TCAs/antidepressants. Amitriptyline, nortriptyline are sensitive CYP2D6 substrates. Poor metabolizers accumulate toxic TCA levels causing QTc prolongation, anticholinergic toxicity. Strong CYP2D6 inhibitors (fluoxetine, paroxetine) combined with TCAs is a high-risk combination. CPIC recommends 50% dose reduction or alternative antidepressant in poor metabolizers.",
    source: "CPIC",
    drugs: "amitriptyline fluoxetine paroxetine",
    enzyme: "CYP2D6"
  },
  {
    id: "pharmgkb_rifampin_inducer",
    content: "PharmGKB Annotation: Rifampin as pan-CYP inducer. Rifampin is the strongest known CYP inducer, affecting CYP3A4, CYP2C9, CYP2C19, CYP2D6. Co-administration with warfarin reduces INR by 60-80%. Reduces clopidogrel active metabolite. Dramatically reduces statin, opioid, and immunosuppressant levels. Co-administration with most drugs requires dose doubling or avoidance.",
    source: "PharmGKB",
    drugs: "rifampin warfarin clopidogrel simvastatin",
    enzyme: "CYP3A4 CYP2C9 CYP2C19"
  },
  {
    id: "cpic_cyp2d6_opioids",
    content: "CPIC Guideline: CYP2D6 and opioids (tramadol, oxycodone). Tramadol requires CYP2D6 activation to O-desmethyltramadol. Poor metabolizers get inadequate analgesia; ultrarapid metabolizers risk toxicity. Oxycodone is primarily CYP3A4 but also CYP2D6. CPIC recommends morphine or hydromorphone (non-CYP2D6) as alternatives for poor metabolizers on tramadol.",
    source: "CPIC",
    drugs: "tramadol oxycodone codeine",
    enzyme: "CYP2D6"
  },
];

async function ingest() {
  console.log("Connecting to ChromaDB...");
  const client = new ChromaClient({ host: "localhost", port: 8000, ssl: false });

  // Delete existing collection if it exists (clean rebuild)
  try {
    await client.deleteCollection({ name: COLLECTION_NAME });
    console.log("Deleted existing collection.");
  } catch {
    // Collection didn't exist, that's fine
  }

  const collection = await client.createCollection({
    name: COLLECTION_NAME,
    metadata: { "hnsw:space": "cosine" },
  });

  console.log(`Ingesting ${KNOWLEDGE_BASE.length} documents...`);

  await collection.add({
    ids: KNOWLEDGE_BASE.map((d) => d.id),
    documents: KNOWLEDGE_BASE.map((d) => d.content),
    metadatas: KNOWLEDGE_BASE.map((d) => ({
      source: d.source,
      drugs: d.drugs,
      enzyme: d.enzyme,
    })),
  });

  console.log("✅ Ingestion complete!");
  console.log(`Collection: ${COLLECTION_NAME}`);
  console.log(`Documents: ${KNOWLEDGE_BASE.length}`);
}

ingest().catch(console.error);
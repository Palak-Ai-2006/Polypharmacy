import { NextRequest, NextResponse } from "next/server"

// Mock drug database - in production, this would connect to RxNorm or similar
const DRUG_DATABASE = [
  { rxcui: "1", name: "Warfarin" },
  { rxcui: "2", name: "Clopidogrel" },
  { rxcui: "3", name: "Omeprazole" },
  { rxcui: "4", name: "Fluoxetine" },
  { rxcui: "5", name: "Simvastatin" },
  { rxcui: "6", name: "Atorvastatin" },
  { rxcui: "7", name: "Amiodarone" },
  { rxcui: "8", name: "Carbamazepine" },
  { rxcui: "9", name: "Phenytoin" },
  { rxcui: "10", name: "Rifampin" },
  { rxcui: "11", name: "Ketoconazole" },
  { rxcui: "12", name: "Itraconazole" },
  { rxcui: "13", name: "Clarithromycin" },
  { rxcui: "14", name: "Erythromycin" },
  { rxcui: "15", name: "Metoprolol" },
  { rxcui: "16", name: "Codeine" },
  { rxcui: "17", name: "Tramadol" },
  { rxcui: "18", name: "Oxycodone" },
  { rxcui: "19", name: "Hydrocodone" },
  { rxcui: "20", name: "Paroxetine" },
  { rxcui: "21", name: "Sertraline" },
  { rxcui: "22", name: "Bupropion" },
  { rxcui: "23", name: "Duloxetine" },
  { rxcui: "24", name: "Venlafaxine" },
  { rxcui: "25", name: "Citalopram" },
  { rxcui: "26", name: "Escitalopram" },
  { rxcui: "27", name: "Methadone" },
  { rxcui: "28", name: "Fentanyl" },
  { rxcui: "29", name: "Morphine" },
  { rxcui: "30", name: "Tamoxifen" },
  { rxcui: "31", name: "Losartan" },
  { rxcui: "32", name: "Voriconazole" },
  { rxcui: "33", name: "Fluconazole" },
  { rxcui: "34", name: "Diltiazem" },
  { rxcui: "35", name: "Verapamil" },
  { rxcui: "36", name: "Cyclosporine" },
  { rxcui: "37", name: "Tacrolimus" },
  { rxcui: "38", name: "Ritonavir" },
  { rxcui: "39", name: "Grapefruit juice" },
  { rxcui: "40", name: "St. John's Wort" },
]

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("q")?.toLowerCase() || ""

  if (query.length < 2) {
    return NextResponse.json([])
  }

  const results = DRUG_DATABASE.filter((drug) =>
    drug.name.toLowerCase().includes(query)
  ).slice(0, 10)

  return NextResponse.json(results)
}

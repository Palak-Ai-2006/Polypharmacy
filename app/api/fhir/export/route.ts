// ============================================================
// POST /api/fhir/export — Export analysis as FHIR R4 Bundle
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { detectCollisions } from "@/lib/collision-detector";
import { toFHIRBundle } from "@/lib/fhir/converter";
import type { PatientInput, MetabolizerPhenotype } from "@/lib/types";

function normalizePhenotype(val: string): MetabolizerPhenotype {
  const map: Record<string, MetabolizerPhenotype> = { "ultra-rapid": "ultrarapid", ultrarapid: "ultrarapid" };
  return (map[val.toLowerCase()] ?? val.toLowerCase()) as MetabolizerPhenotype;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const raw = body.patient;

    if (!raw?.drugs?.length) {
      return NextResponse.json({ error: "Patient must have at least one drug" }, { status: 400 });
    }

    const patient: PatientInput = {
      name: raw.name,
      age: raw.age,
      drugs: raw.drugs,
      geneticProfile: {
        CYP3A4: normalizePhenotype(raw.geneticProfile?.CYP3A4 ?? "unknown"),
        CYP2D6: normalizePhenotype(raw.geneticProfile?.CYP2D6 ?? "unknown"),
        CYP2C19: normalizePhenotype(raw.geneticProfile?.CYP2C19 ?? "unknown"),
        CYP2C9: normalizePhenotype(raw.geneticProfile?.CYP2C9 ?? "unknown"),
      },
    };

    const collisionMap = detectCollisions(patient);
    const bundle = toFHIRBundle(patient, collisionMap);

    return NextResponse.json(bundle, {
      headers: { "Content-Type": "application/fhir+json" },
    });
  } catch (error) {
    console.error("FHIR export error:", error);
    return NextResponse.json({ error: "Failed to generate FHIR bundle" }, { status: 500 });
  }
}

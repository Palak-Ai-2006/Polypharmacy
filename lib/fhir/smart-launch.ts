// ============================================================
// SMART on FHIR Launch Handler
// Implements SMART App Launch Framework (v2.0) for:
//   - EHR Launch: launched from within an EHR (Epic, Cerner)
//   - Standalone Launch: launched independently, user picks patient
// ============================================================

import type { PatientInput, MetabolizerPhenotype, CYPEnzyme } from "../types";

// ---- Configuration ----

export interface SMARTConfig {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  issuer?: string;     // FHIR server base URL (from launch context)
}

export const DEFAULT_SCOPES = [
  "launch",
  "launch/patient",
  "patient/Patient.read",
  "patient/MedicationRequest.read",
  "patient/Observation.read",
  "openid",
  "fhirUser",
];

// ---- Launch URL Construction ----

/**
 * Build the SMART authorization URL for EHR launch or standalone launch.
 * The EHR redirects the user here; we then redirect to our app with a code.
 */
export function buildAuthorizationUrl(
  authorizeEndpoint: string,
  config: SMARTConfig,
  launchToken?: string, // present in EHR launch, absent in standalone
  state?: string
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(" "),
    state: state ?? crypto.randomUUID(),
    aud: config.issuer ?? authorizeEndpoint.replace(/\/authorize$/, ""),
  });

  if (launchToken) {
    params.set("launch", launchToken);
  }

  return `${authorizeEndpoint}?${params.toString()}`;
}

/**
 * Exchange the authorization code for an access token.
 * Returns the token response including patient context.
 */
export async function exchangeCodeForToken(
  tokenEndpoint: string,
  code: string,
  config: SMARTConfig
): Promise<SMARTTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
  });

  const res = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`SMART token exchange failed: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

export interface SMARTTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  patient?: string;       // patient ID from launch context
  id_token?: string;
}

// ---- FHIR Data Fetching ----

/**
 * Fetch patient demographics, medications, and PGx observations from the FHIR server.
 * Auto-populates a PatientInput from the EHR launch context.
 */
export async function fetchPatientContext(
  fhirBaseUrl: string,
  patientId: string,
  accessToken: string
): Promise<PatientInput> {
  const headers = { Authorization: `Bearer ${accessToken}`, Accept: "application/fhir+json" };

  // Fetch patient demographics
  const patientRes = await fetch(`${fhirBaseUrl}/Patient/${patientId}`, { headers });
  const patientData = patientRes.ok ? await patientRes.json() : null;

  // Fetch active medications
  const medRes = await fetch(
    `${fhirBaseUrl}/MedicationRequest?patient=${patientId}&status=active`,
    { headers }
  );
  const medBundle = medRes.ok ? await medRes.json() : { entry: [] };
  const drugs: string[] = (medBundle.entry ?? [])
    .map((e: any) => e.resource?.medicationCodeableConcept?.text)
    .filter(Boolean);

  // Fetch PGx observations (genetic)
  const obsRes = await fetch(
    `${fhirBaseUrl}/Observation?patient=${patientId}&category=laboratory&code=http://loinc.org|81247-9,http://loinc.org|79714-2,http://loinc.org|79713-4,http://loinc.org|94007-1`,
    { headers }
  );
  const obsBundle = obsRes.ok ? await obsRes.json() : { entry: [] };
  const geneticProfile = extractGeneticProfile(obsBundle.entry ?? []);

  // Extract age from birthDate
  let age: number | undefined;
  if (patientData?.birthDate) {
    const birthYear = new Date(patientData.birthDate).getFullYear();
    age = new Date().getFullYear() - birthYear;
  }

  const name = patientData?.name?.[0]
    ? `${patientData.name[0].given?.[0] ?? ""} ${patientData.name[0].family ?? ""}`.trim()
    : undefined;

  return {
    name,
    age,
    drugs,
    geneticProfile,
  };
}

function extractGeneticProfile(entries: any[]): PatientInput["geneticProfile"] {
  const profile: PatientInput["geneticProfile"] = {
    CYP3A4: "unknown",
    CYP2D6: "unknown",
    CYP2C19: "unknown",
    CYP2C9: "unknown",
  };

  const LOINC_TO_ENZYME: Record<string, CYPEnzyme> = {
    "94007-1": "CYP3A4",
    "81247-9": "CYP2D6",
    "79714-2": "CYP2C19",
    "79713-4": "CYP2C9",
  };

  for (const entry of entries) {
    const obs = entry.resource;
    if (!obs?.code?.coding) continue;

    for (const coding of obs.code.coding) {
      const enzyme = LOINC_TO_ENZYME[coding.code];
      if (!enzyme) continue;

      const phenoText = obs.valueCodeableConcept?.text?.toLowerCase() ?? "";
      const phenotype = parsePhenotype(phenoText);
      if (phenotype) {
        profile[enzyme] = phenotype;
      }
    }
  }

  return profile;
}

function parsePhenotype(text: string): MetabolizerPhenotype | null {
  if (text.includes("poor")) return "poor";
  if (text.includes("intermediate")) return "intermediate";
  if (text.includes("ultrarapid") || text.includes("ultra-rapid")) return "ultrarapid";
  if (text.includes("rapid")) return "rapid";
  if (text.includes("normal") || text.includes("extensive")) return "normal";
  return null;
}

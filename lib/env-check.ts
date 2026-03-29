// ============================================================
// Environment Variable Validation
// Fail fast with clear errors instead of runtime crashes.
// ============================================================

interface EnvVar {
  key: string;
  required: boolean;
  description: string;
  default?: string;
}

const ENV_VARS: EnvVar[] = [
  {
    key: 'GEMINI_API_KEY',
    required: true,
    description: 'Google Gemini API key (free at https://aistudio.google.com)',
  },
  {
    key: 'CHROMA_URL',
    required: false,
    description: 'ChromaDB endpoint for RAG retrieval',
    default: 'http://localhost:8000',
  },
];

export interface EnvCheckResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Validates required environment variables at startup.
 * Returns a result object instead of throwing to allow graceful handling.
 */
export function checkEnvironment(): EnvCheckResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const v of ENV_VARS) {
    const value = process.env[v.key];
    if (!value && v.required) {
      missing.push(`${v.key} — ${v.description}`);
    } else if (!value && !v.required) {
      warnings.push(`${v.key} not set, using default: ${v.default ?? 'none'}`);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Logs environment check results to console.
 * Call this at server startup.
 */
export function logEnvironmentCheck(): void {
  const result = checkEnvironment();

  if (result.warnings.length > 0) {
    for (const w of result.warnings) {
      console.log(`⚠ ENV: ${w}`);
    }
  }

  if (!result.valid) {
    console.error('━'.repeat(60));
    console.error('MISSING REQUIRED ENVIRONMENT VARIABLES:');
    for (const m of result.missing) {
      console.error(`  ✗ ${m}`);
    }
    console.error('');
    console.error('Copy .env.example to .env.local and fill in the values.');
    console.error('━'.repeat(60));
  }
}

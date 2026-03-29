// ============================================================
// RAG Retriever — queries ChromaDB for relevant clinical docs
// (CPIC guidelines, PharmGKB annotations).
// Uses DefaultEmbeddingFunction (local, no API key needed).
// Gracefully returns "" if ChromaDB is not running.
// ============================================================

import { ChromaClient, CloudClient } from "chromadb";
import { DefaultEmbeddingFunction } from "@chroma-core/default-embed";

const COLLECTION_NAME = "pharmgkb_cpic";
const CHROMA_URL = process.env.CHROMA_URL ?? "http://localhost:8000";

/**
 * Retrieves relevant PharmGKB/CPIC documents for a given drug list.
 * Returns a formatted string ready to inject into the LLM prompt.
 */
export async function retrieveRAGContext(drugs: string[]): Promise<string> {
  // Vercel/serverless has no local ChromaDB process; skip unless explicitly configured.
  const useCloud =
    Boolean(process.env.CHROMA_API_KEY) &&
    Boolean(process.env.CHROMA_TENANT) &&
    Boolean(process.env.CHROMA_DATABASE);

  if (process.env.VERCEL && !useCloud) {
    return "";
  }

  try {
    const client = useCloud
      ? new CloudClient({
          apiKey: process.env.CHROMA_API_KEY,
          tenant: process.env.CHROMA_TENANT,
          database: process.env.CHROMA_DATABASE,
        })
      : (() => {
          const chromaUrl = new URL(CHROMA_URL);
          return new ChromaClient({
            host: chromaUrl.hostname,
            port: Number(chromaUrl.port || (chromaUrl.protocol === "https:" ? 443 : 80)),
            ssl: chromaUrl.protocol === "https:",
          });
        })();
    const embedder = new DefaultEmbeddingFunction();

    const collection = await client.getCollection({
      name: COLLECTION_NAME,
      embeddingFunction: embedder,
    });

    const query = drugs.join(" ");
    const results = await collection.query({
      queryTexts: [query],
      nResults: 4,
    });

    const docs = results.documents?.[0] ?? [];
    const metas = results.metadatas?.[0] ?? [];

    if (docs.length === 0) return "";

    return docs
      .map((doc, i) => {
        const meta = metas[i] as { source?: string };
        return `[${meta?.source ?? "Unknown"}] ${doc}`;
      })
      .join("\n\n");
  } catch (error) {
    // ChromaDB not running — gracefully skip RAG
    console.warn("ChromaDB unavailable, skipping RAG:", error);
    return "";
  }
}

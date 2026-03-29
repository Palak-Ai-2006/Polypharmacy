// ============================================================
// RAG Retriever — queries ChromaDB for relevant clinical docs
// (CPIC guidelines, PharmGKB annotations).
// Uses DefaultEmbeddingFunction (local, no API key needed).
// Gracefully returns "" if ChromaDB is not running.
// ============================================================

import { ChromaClient } from "chromadb";
import { DefaultEmbeddingFunction } from "@chroma-core/default-embed";

const COLLECTION_NAME = "pharmgkb_cpic";

/**
 * Retrieves relevant PharmGKB/CPIC documents for a given drug list.
 * Returns a formatted string ready to inject into the LLM prompt.
 */
export async function retrieveRAGContext(drugs: string[]): Promise<string> {
  try {
    const client = new ChromaClient({ host: "localhost", port: 8000, ssl: false });
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

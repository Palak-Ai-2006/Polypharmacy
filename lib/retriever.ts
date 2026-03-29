// ============================================================
// RAG Retriever — queries ChromaDB for relevant clinical docs
// ============================================================

import { ChromaClient } from "chromadb";

const COLLECTION_NAME = "pharmgkb_cpic";
let client: ChromaClient | null = null;

function getClient(): ChromaClient {
  if (!client) {
    client = new ChromaClient({ path: "http://localhost:8000" });
  }
  return client;
}

/**
 * Retrieves relevant PharmGKB/CPIC documents for a given drug list.
 * Returns a formatted string ready to inject into the LLM prompt.
 */
export async function retrieveRAGContext(drugs: string[]): Promise<string> {
  try {
    const chroma = getClient();
    const collection = await chroma.getCollection({ name: COLLECTION_NAME });

    // Build query from drug names
    const query = drugs.join(" ");

    const results = await collection.query({
      queryTexts: [query],
      nResults: 4, // top 4 most relevant chunks
    });

    const docs = results.documents?.[0] ?? [];
    const metas = results.metadatas?.[0] ?? [];

    if (docs.length === 0) return "";

    const formatted = docs
      .map((doc, i) => {
        const meta = metas[i] as { source?: string; drugs?: string };
        return `[${meta?.source ?? "Unknown"}] ${doc}`;
      })
      .join("\n\n");

    return formatted;
  } catch (error) {
    // ChromaDB not running — gracefully skip RAG
    console.warn("ChromaDB unavailable, skipping RAG:", error);
    return "";
  }
}
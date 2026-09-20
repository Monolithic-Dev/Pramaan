import type { CategorizationClient } from "./lib/gemini.js";
import { createCategorizationClient } from "./lib/gemini.js";
import type { EmbeddingClient } from "./lib/embeddings.js";
import { createEmbeddingClient } from "./lib/embeddings.js";
import type { ReferenceDataClient } from "./lib/bigquery.js";
import { createBigQueryReferenceDataClient } from "./lib/bigquery.js";
import { createGeminiTranscriber, type Transcriber } from "./lib/transcription.js";
import { getDb } from "./lib/firebaseAdmin.js";
import { createFirestoreStore } from "./store/firestoreStore.js";
import type { Store } from "./store/types.js";

export interface Deps {
  store: Store;
  categorization: CategorizationClient;
  embeddings: EmbeddingClient;
  referenceData: ReferenceDataClient;
  transcriber: Transcriber;
}

export function createRealDeps(): Deps {
  return {
    store: createFirestoreStore(getDb()),
    categorization: createCategorizationClient(),
    embeddings: createEmbeddingClient(),
    referenceData: createBigQueryReferenceDataClient(),
    transcriber: createGeminiTranscriber(),
  };
}

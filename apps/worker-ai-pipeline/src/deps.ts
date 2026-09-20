import type { CategorizationClient } from "./lib/gemini.js";
import { createCategorizationClient } from "./lib/gemini.js";
import type { EmbeddingClient } from "./lib/embeddings.js";
import { createEmbeddingClient } from "./lib/embeddings.js";
import type { ReferenceDataClient } from "./lib/bigquery.js";
import { createBigQueryReferenceDataClient } from "./lib/bigquery.js";
import { createGeminiTranscriber, type Transcriber } from "./lib/transcription.js";
import { createFirestoreReferenceDataClient } from "./lib/firestoreReference.js";
import { createGeminiPhotoAnalyzer, type PhotoAnalyzer } from "./lib/vision.js";
import { getDb } from "./lib/firebaseAdmin.js";
import { createFirestoreStore } from "./store/firestoreStore.js";
import type { Store } from "./store/types.js";

export interface Deps {
  store: Store;
  categorization: CategorizationClient;
  embeddings: EmbeddingClient;
  referenceData: ReferenceDataClient;
  transcriber: Transcriber;
  photoAnalyzer: PhotoAnalyzer;
}

export function createRealDeps(): Deps {
  return {
    store: createFirestoreStore(getDb()),
    categorization: createCategorizationClient(),
    embeddings: createEmbeddingClient(),
    // Firestore by default (free Spark plan, no billing); REFERENCE_BACKEND=bigquery for the GCP path.
    referenceData:
      process.env.REFERENCE_BACKEND === "bigquery"
        ? createBigQueryReferenceDataClient()
        : createFirestoreReferenceDataClient(getDb()),
    transcriber: createGeminiTranscriber(getDb()),
    photoAnalyzer: createGeminiPhotoAnalyzer(getDb()),
  };
}

import { createFirebaseAuthVerifier, type AuthVerifier } from "./lib/authVerifier.js";
import { createBigQueryAgentClient, type BigQueryAgentClient } from "./lib/bigquery.js";
import { createFirestoreAgentClient } from "./lib/firestoreReference.js";
import { getDb } from "./lib/firebaseAdmin.js";
import { createGeminiAgentClient, type GeminiAgentClient } from "./lib/geminiAgent.js";
import { createIdentityToolkit, type IdentityToolkit } from "./lib/identityToolkit.js";
import { createFirestoreMediaStore, createGcsMediaStore, type MediaStore } from "./lib/mediaStore.js";
import { createFirebaseOfficerAdmin, type OfficerAdmin } from "./lib/officerAdmin.js";
import { createGeminiNarrator, type Narrator } from "./lib/narrator.js";
import { createGeminiTranslator, type Translator } from "./lib/translator.js";
import { createHttpPublisher, createPubSubPublisher, type Publisher } from "./lib/pubsub.js";
import { createFirestoreStore } from "./store/firestoreStore.js";
import type { Store } from "./store/types.js";

export interface Deps {
  store: Store;
  publisher: Publisher;
  identityToolkit: IdentityToolkit;
  authVerifier: AuthVerifier;
  bigqueryAgent: BigQueryAgentClient;
  geminiAgent: GeminiAgentClient;
  mediaStore: MediaStore;
  translator: Translator;
  narrator: Narrator;
  officerAdmin: OfficerAdmin;
}

export function createRealDeps(): Deps {
  return {
    store: createFirestoreStore(getDb()),
    publisher: process.env.WORKER_URL
      ? createHttpPublisher(process.env.WORKER_URL, process.env.WORKER_SHARED_SECRET ?? "")
      : createPubSubPublisher(),
    identityToolkit: createIdentityToolkit(),
    authVerifier: createFirebaseAuthVerifier(),
    bigqueryAgent:
      process.env.REFERENCE_BACKEND === "bigquery"
        ? createBigQueryAgentClient()
        : createFirestoreAgentClient(getDb()),
    geminiAgent: createGeminiAgentClient(),
    mediaStore: process.env.MEDIA_BUCKET ? createGcsMediaStore() : createFirestoreMediaStore(getDb()),
    translator: createGeminiTranslator(),
    narrator: createGeminiNarrator(),
    officerAdmin: createFirebaseOfficerAdmin(),
  };
}

import { createFirebaseAuthVerifier, type AuthVerifier } from "./lib/authVerifier.js";
import { createBigQueryAgentClient, type BigQueryAgentClient } from "./lib/bigquery.js";
import { getDb } from "./lib/firebaseAdmin.js";
import { createGeminiAgentClient, type GeminiAgentClient } from "./lib/geminiAgent.js";
import { createIdentityToolkit, type IdentityToolkit } from "./lib/identityToolkit.js";
import { createPubSubPublisher, type Publisher } from "./lib/pubsub.js";
import { createFirestoreStore } from "./store/firestoreStore.js";
import type { Store } from "./store/types.js";

export interface Deps {
  store: Store;
  publisher: Publisher;
  identityToolkit: IdentityToolkit;
  authVerifier: AuthVerifier;
  bigqueryAgent: BigQueryAgentClient;
  geminiAgent: GeminiAgentClient;
}

export function createRealDeps(): Deps {
  return {
    store: createFirestoreStore(getDb()),
    publisher: createPubSubPublisher(),
    identityToolkit: createIdentityToolkit(),
    authVerifier: createFirebaseAuthVerifier(),
    bigqueryAgent: createBigQueryAgentClient(),
    geminiAgent: createGeminiAgentClient(),
  };
}

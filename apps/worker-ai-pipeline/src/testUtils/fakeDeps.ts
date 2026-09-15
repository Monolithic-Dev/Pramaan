import type { CategorizationResult } from "@jansetu/ai-prompts";
import type { Deps } from "../deps.js";
import type { CategorizationClient } from "../lib/gemini.js";
import type { EmbeddingClient } from "../lib/embeddings.js";
import { createInMemoryStore } from "../store/inMemoryStore.js";

export interface FakeDeps extends Deps {
  /** Queue consumed front-to-back by categorization.categorize(); a `null` entry
   *  simulates a malformed/failed extraction (docs/EDGE_CASES.md #9). */
  nextCategorizations: (CategorizationResult | null)[];
  /** Explicit embeddings by exact input text; falls back to a deterministic
   *  per-text vector (same text -> same vector) when not set. */
  embeddingsByText: Map<string, number[]>;
}

function defaultEmbeddingFor(text: string): number[] {
  // Deterministic pseudo-embedding so unconfigured calls don't collide by
  // chance — tests that care about a specific similarity set embeddingsByText.
  let seed = 0;
  for (let i = 0; i < text.length; i++) seed = (seed * 31 + text.charCodeAt(i)) >>> 0;
  const vec = Array.from({ length: 8 }, (_, i) => Math.sin(seed + i));
  return vec;
}

export function createFakeDeps(): FakeDeps {
  const nextCategorizations: (CategorizationResult | null)[] = [];
  const embeddingsByText = new Map<string, number[]>();

  const categorization: CategorizationClient = {
    async categorize() {
      if (nextCategorizations.length === 0) {
        throw new Error("createFakeDeps: no queued categorization result — configure one");
      }
      return nextCategorizations.shift() ?? null;
    },
  };

  const embeddings: EmbeddingClient = {
    async embed(text) {
      return embeddingsByText.get(text) ?? defaultEmbeddingFor(text);
    },
  };

  return {
    store: createInMemoryStore(),
    categorization,
    embeddings,
    nextCategorizations,
    embeddingsByText,
  };
}

import { withRetry } from "@jansetu/shared-utils";
import { env } from "./env.js";
import { buildGenAI } from "./genai.js";

export interface EmbeddingClient {
  /** text-embedding-005, 768-dim, over the categorization summary (docs/AI_PIPELINE.md Stage 3). */
  embed(text: string): Promise<number[]>;
}

export function createEmbeddingClient(): EmbeddingClient {
  const ai = buildGenAI();

  return {
    async embed(text) {
      const response = await withRetry(() =>
        ai.models.embedContent({
          model: env.embeddingModel,
          contents: text,
          config: { outputDimensionality: 768 },
        }),
      );
      const values = response.embeddings?.[0]?.values;
      if (!values) throw new Error("embedContent returned no embedding values");
      return values;
    },
  };
}

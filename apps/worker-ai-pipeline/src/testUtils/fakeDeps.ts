import type { CategorizationResult } from "@pramaan/ai-prompts";
import type { Deps } from "../deps.js";
import type { CategorizationClient } from "../lib/gemini.js";
import type { EmbeddingClient } from "../lib/embeddings.js";
import type {
  AncestryStep,
  LatestInvestment,
  ReferenceDataClient,
  RegionCentroid,
  RegionInfraData,
} from "../lib/bigquery.js";
import type { Transcriber, Transcript } from "../lib/transcription.js";
import type { PhotoAnalysis, PhotoAnalyzer } from "../lib/vision.js";
import { createInMemoryStore } from "../store/inMemoryStore.js";

export interface FakeDeps extends Deps {
  /** Queue consumed front-to-back by categorization.categorize(); a `null` entry
   *  simulates a malformed/failed extraction (docs/EDGE_CASES.md #9). */
  nextCategorizations: (CategorizationResult | null)[];
  /** Explicit embeddings by exact input text; falls back to a deterministic
   *  per-text vector (same text -> same vector) when not set. */
  embeddingsByText: Map<string, number[]>;
  /** Test-configurable reference data, keyed by regionId (and regionId+category). */
  ancestryByRegion: Map<string, AncestryStep[]>;
  infraIndexByRegion: Map<string, RegionInfraData | null>;
  latestInvestmentByRegionCategory: Map<string, LatestInvestment | null>;
  /** Empty by default -> resolveLocation() resolves nothing, same as before
   *  region resolution existed. Populate to test real nearest-centroid matching. */
  regionCentroids: RegionCentroid[];
  /** Queue consumed by transcriber.transcribe(); a `null` entry = no intelligible speech. */
  nextTranscripts: (Transcript | null)[];
  /** Queue consumed by photoAnalyzer.analyze(); empty queue = analysis unavailable (null). */
  nextPhotoAnalyses: (PhotoAnalysis | null)[];
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
  const ancestryByRegion = new Map<string, AncestryStep[]>();
  const infraIndexByRegion = new Map<string, RegionInfraData | null>();
  const latestInvestmentByRegionCategory = new Map<string, LatestInvestment | null>();
  const regionCentroids: RegionCentroid[] = [];
  const nextTranscripts: (Transcript | null)[] = [];
  const nextPhotoAnalyses: (PhotoAnalysis | null)[] = [];
  const photoAnalyzer: PhotoAnalyzer = {
    async analyze() {
      return nextPhotoAnalyses.shift() ?? null;
    },
  };
  const transcriber: Transcriber = {
    async transcribe() {
      if (nextTranscripts.length === 0) throw new Error("createFakeDeps: no queued transcript");
      return nextTranscripts.shift() ?? null;
    },
  };

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

  const referenceData: ReferenceDataClient = {
    async getAncestryChain(regionId) {
      return ancestryByRegion.get(regionId) ?? [{ regionId, level: "ward" }];
    },
    async getInfraIndex(regionId) {
      return infraIndexByRegion.has(regionId) ? infraIndexByRegion.get(regionId)! : null;
    },
    async getLatestInvestment(regionId, category) {
      const key = `${regionId}|${category}`;
      return latestInvestmentByRegionCategory.has(key)
        ? latestInvestmentByRegionCategory.get(key)!
        : null;
    },
    async getAllRegionCentroids() {
      return regionCentroids;
    },
    async getRegionPopulation(regionId) {
      return regionCentroids.find((r) => r.regionId === regionId)?.population ?? null;
    },
  };

  return {
    store: createInMemoryStore(),
    categorization,
    embeddings,
    referenceData,
    transcriber,
    photoAnalyzer,
    nextTranscripts,
    nextPhotoAnalyses,
    nextCategorizations,
    embeddingsByText,
    ancestryByRegion,
    infraIndexByRegion,
    latestInvestmentByRegionCategory,
    regionCentroids,
  };
}

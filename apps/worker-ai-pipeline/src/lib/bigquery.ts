import { BigQuery } from "@google-cloud/bigquery";
import { withRetry } from "@pramaan/shared-utils";
import { env } from "./env.js";

const DATASET = "pramaan_analytics";
// admin_regions lives in a separate dataset from infra_index/investment_record
// (infra/gcp/setup.sh, scripts/seed-demo-data/generateReferenceData.ts) — it's
// reference/master data, not a per-run analytics table. Querying it from
// DATASET would 404 against a real project.
const REFERENCE_DATASET = "pramaan_reference";
const MAX_ANCESTRY_HOPS = 6; // ward -> block -> district -> state -> country, with headroom

export interface RegionInfraData {
  /** index_type -> most recent normalised_value at this exact region. */
  normalisedValuesByType: Record<string, number>;
}

export interface LatestInvestment {
  fiscalYear: string;
}

// Seam over BigQuery reference-data joins (docs/AI_PIPELINE.md Stage 6) — real
// impl below, a fake in testUtils/fakeDeps.ts for unit tests.
export interface AncestryStep {
  regionId: string;
  level: string;
}

export interface RegionCentroid {
  regionId: string;
  /** Optional so existing single-country test fixtures don't need updating —
   *  resolveLocation() treats a missing value as "matches any country". */
  countryCode?: string;
  level: string;
  parentRegionId: string | null;
  lat: number;
  lng: number;
  population: number;
}

export interface ReferenceDataClient {
  /** [self, parent, grandparent, ...] up to the country level, each with its AdminRegion level. */
  getAncestryChain(regionId: string): Promise<AncestryStep[]>;
  getInfraIndex(regionId: string): Promise<RegionInfraData | null>;
  getLatestInvestment(regionId: string, category: string): Promise<LatestInvestment | null>;
  /** Every seeded AdminRegion's centroid — small table (~tens of rows at
   *  hackathon scale), fetched whole and matched in-memory (see regionResolution.ts). */
  getAllRegionCentroids(): Promise<RegionCentroid[]>;
  /** For docs/phases/phase-5-scoring.md §5.6's population-weighted impact estimate. */
  getRegionPopulation(regionId: string): Promise<number | null>;
}

export function createBigQueryReferenceDataClient(): ReferenceDataClient {
  const bq = new BigQuery({ projectId: env.gcpProjectId });

  async function query<T>(sql: string, params: Record<string, unknown>): Promise<T[]> {
    return withRetry<T[]>(async () => {
      const [rows] = await bq.query({ query: sql, params, location: env.vertexLocation });
      return rows as T[];
    });
  }

  return {
    async getAncestryChain(regionId) {
      const chain: AncestryStep[] = [];
      let current: string | null = regionId;
      for (let i = 0; i < MAX_ANCESTRY_HOPS && current; i++) {
        type AncestryRow = { level: string; parent_region_id: string | null };
        const rows: AncestryRow[] = await query<AncestryRow>(
          `SELECT level, parent_region_id FROM \`${REFERENCE_DATASET}.admin_regions\` WHERE region_id = @regionId LIMIT 1`,
          { regionId: current },
        );
        const row: AncestryRow | undefined = rows[0];
        if (!row) break;
        chain.push({ regionId: current, level: row.level });
        current = row.parent_region_id;
      }
      return chain;
    },

    async getInfraIndex(regionId) {
      const rows = await query<{ index_type: string; normalised_value: number }>(
        `SELECT index_type, normalised_value FROM \`${DATASET}.infra_index\`
         WHERE region_id = @regionId
         QUALIFY ROW_NUMBER() OVER (PARTITION BY index_type ORDER BY year DESC) = 1`,
        { regionId },
      );
      if (rows.length === 0) return null;
      const normalisedValuesByType: Record<string, number> = {};
      for (const row of rows) normalisedValuesByType[row.index_type] = row.normalised_value;
      return { normalisedValuesByType };
    },

    async getLatestInvestment(regionId, category) {
      const rows = await query<{ fiscal_year: string }>(
        `SELECT fiscal_year FROM \`${DATASET}.investment_record\`
         WHERE region_id = @regionId AND category = @category
         ORDER BY fiscal_year DESC LIMIT 1`,
        { regionId, category },
      );
      return rows[0] ? { fiscalYear: rows[0].fiscal_year } : null;
    },

    async getAllRegionCentroids() {
      const rows = await query<{
        region_id: string;
        country_code: string;
        level: string;
        parent_region_id: string | null;
        centroid_lat: number;
        centroid_lng: number;
        population: number;
      }>(
        `SELECT region_id, country_code, level, parent_region_id, centroid_lat, centroid_lng, population FROM \`${REFERENCE_DATASET}.admin_regions\``,
        {},
      );
      return rows.map((r) => ({
        regionId: r.region_id,
        countryCode: r.country_code,
        level: r.level,
        parentRegionId: r.parent_region_id,
        lat: r.centroid_lat,
        lng: r.centroid_lng,
        population: r.population,
      }));
    },

    async getRegionPopulation(regionId) {
      const rows = await query<{ population: number }>(
        `SELECT population FROM \`${REFERENCE_DATASET}.admin_regions\` WHERE region_id = @regionId LIMIT 1`,
        { regionId },
      );
      return rows[0]?.population ?? null;
    },
  };
}

/** "2024-25" -> 2024. Indian fiscal years are named by their starting calendar year. */
export function parseFiscalYearStart(fiscalYear: string): number {
  return Number(fiscalYear.split("-")[0]);
}

/** Fiscal year running April-March; a date in Jan-Mar belongs to the FY that started the previous calendar year. */
export function currentFiscalYearStart(asOf: Date): number {
  return asOf.getMonth() >= 3 ? asOf.getFullYear() : asOf.getFullYear() - 1;
}

import { BigQuery } from "@google-cloud/bigquery";
import { withRetry } from "@jansetu/shared-utils";
import { env } from "./env.js";

const DATASET = "jansetu_analytics";
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

export interface ReferenceDataClient {
  /** [self, parent, grandparent, ...] up to the country level, each with its AdminRegion level. */
  getAncestryChain(regionId: string): Promise<AncestryStep[]>;
  getInfraIndex(regionId: string): Promise<RegionInfraData | null>;
  getLatestInvestment(regionId: string, category: string): Promise<LatestInvestment | null>;
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
          `SELECT level, parent_region_id FROM \`${DATASET}.admin_regions\` WHERE region_id = @regionId LIMIT 1`,
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

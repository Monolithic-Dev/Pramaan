import { BigQuery } from "@google-cloud/bigquery";
import { withRetry } from "@jansetu/shared-utils";
import { env } from "./env.js";

const DATASET = "jansetu_analytics";
// admin_regions lives in a separate dataset from infra_index/investment_record
// (infra/gcp/setup.sh, scripts/seed-demo-data/generateReferenceData.ts) — it's
// reference/master data, not a per-run analytics table. Querying it from
// DATASET would 404 against a real project.
const REFERENCE_DATASET = "jansetu_reference";
const MAX_ANCESTRY_HOPS = 6;

export interface AncestryStep {
  regionId: string;
  level: string;
}

export interface InvestmentSummary {
  investment_id: string;
  scheme_name: string;
  amount: number;
  currency: string;
  fiscal_year: string;
  data_origin: string;
}

export interface AvailableData {
  infraIndexTypes: string[];
  investmentFiscalYears: string[];
}

// Read-only BigQuery access for the agent's tools (docs/AI_PIPELINE.md Stage
// 5). Same seam pattern as worker-ai-pipeline's lib/bigquery.ts — kept
// separate per service rather than shared, since each service deploys
// independently (docs/TECH_STACK_AND_REPO.md §2.4).
export interface BigQueryAgentClient {
  getAncestryChain(regionId: string): Promise<AncestryStep[]>;
  getInvestmentRecords(regionId: string, category: string): Promise<InvestmentSummary[]>;
  getAvailableData(regionId: string): Promise<AvailableData>;
}

export function createBigQueryAgentClient(): BigQueryAgentClient {
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
        type Row = { level: string; parent_region_id: string | null };
        const rows: Row[] = await query<Row>(
          `SELECT level, parent_region_id FROM \`${REFERENCE_DATASET}.admin_regions\` WHERE region_id = @regionId LIMIT 1`,
          { regionId: current },
        );
        const row: Row | undefined = rows[0];
        if (!row) break;
        chain.push({ regionId: current, level: row.level });
        current = row.parent_region_id;
      }
      return chain;
    },

    async getInvestmentRecords(regionId, category) {
      return query<InvestmentSummary>(
        `SELECT investment_id, scheme_name, amount, currency, fiscal_year, data_origin
         FROM \`${DATASET}.investment_record\`
         WHERE region_id = @regionId AND category = @category
         ORDER BY fiscal_year DESC`,
        { regionId, category },
      );
    },

    async getAvailableData(regionId) {
      const [infraRows, investmentRows] = await Promise.all([
        query<{ index_type: string }>(
          `SELECT DISTINCT index_type FROM \`${DATASET}.infra_index\` WHERE region_id = @regionId`,
          { regionId },
        ),
        query<{ fiscal_year: string }>(
          `SELECT DISTINCT fiscal_year FROM \`${DATASET}.investment_record\` WHERE region_id = @regionId`,
          { regionId },
        ),
      ]);
      return {
        infraIndexTypes: infraRows.map((r) => r.index_type),
        investmentFiscalYears: investmentRows.map((r) => r.fiscal_year),
      };
    },
  };
}

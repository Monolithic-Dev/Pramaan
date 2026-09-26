// Reproducible reference-data load: reads scripts/seed-demo-data/source/*.csv and
// loads them into BigQuery's pramaan_reference.{admin_regions} and
// pramaan_analytics.{infra_index,investment_record} tables. Source CSVs are
// clearly-labeled realistic sample data (per PRD.md §8), covering 3 states/6
// districts across 2 fiscal years — not live government data, and region_id values
// are placeholder district slugs, not yet real LGD codes (see docs/DATA_MODEL.md's
// AdminRegion entity and docs/BUILD_PLAN.md Day-1 task to source real LGD codes).
// Re-running this script is safe: each table is truncated before reload.
//
// Run: GOOGLE_CLOUD_PROJECT=<project-id> pnpm --filter @pramaan/scripts generate-reference-data
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BigQuery } from "@google-cloud/bigquery";
import { loadReferenceRows } from "./referenceCsv.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REFERENCE_DATASET = "pramaan_reference";
const ANALYTICS_DATASET = "pramaan_analytics";

async function loadTable(
  bq: BigQuery,
  dataset: string,
  table: string,
  rows: Record<string, unknown>[],
) {
  const ds = bq.dataset(dataset);
  await ds
    .table(table)
    .delete({ ignoreNotFound: true })
    .catch(() => {});
  const schemaPath = join(__dirname, "..", "..", "infra", "gcp", "bigquery-schemas", `${table}.json`);
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const [created] = await ds.createTable(table, { schema });
  await created.insert(rows);
  console.log(`loaded ${rows.length} rows into ${dataset}.${table}`);
}

async function main() {
  const bq = new BigQuery();
  const { adminRegions, infraIndex, investmentRecord } = loadReferenceRows();
  await loadTable(bq, REFERENCE_DATASET, "admin_regions", adminRegions);
  await loadTable(bq, ANALYTICS_DATASET, "infra_index", infraIndex);
  await loadTable(bq, ANALYTICS_DATASET, "investment_record", investmentRecord);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

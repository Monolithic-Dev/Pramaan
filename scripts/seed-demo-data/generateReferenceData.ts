// Reproducible reference-data load: reads scripts/seed-demo-data/source/*.csv and
// loads them into BigQuery's jansetu_analytics.{infra_index,investment_record}
// tables. Source CSVs are clearly-labeled realistic sample data (per PRD.md §8),
// covering 3 states/6 districts across 2 fiscal years — not live government data.
// Re-running this script is safe: each table is truncated before reload.
//
// Run: GOOGLE_CLOUD_PROJECT=<project-id> pnpm --filter @jansetu/scripts generate-reference-data
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BigQuery } from "@google-cloud/bigquery";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = join(__dirname, "source");
const DATASET = "jansetu_analytics";

function parseCsv(path: string): Record<string, string>[] {
  const [headerLine, ...lines] = readFileSync(path, "utf8").trim().split("\n");
  const headers = headerLine.split(",");
  return lines.map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
  });
}

async function loadTable(
  bq: BigQuery,
  table: string,
  rows: Record<string, unknown>[],
) {
  await bq.dataset(DATASET).table(table).delete({ ignoreNotFound: true }).catch(() => {});
  const schemaPath = join(__dirname, "..", "..", "infra", "gcp", "bigquery-schemas", `${table}.json`);
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const [created] = await bq.dataset(DATASET).createTable(table, { schema });
  await created.insert(rows);
  console.log(`loaded ${rows.length} rows into ${table}`);
}

async function main() {
  const bq = new BigQuery();

  const infraIndex = parseCsv(join(SOURCE_DIR, "infra_index.csv")).map((r) => ({
    ...r,
    value: Number(r.value),
    year: Number(r.year),
  }));
  await loadTable(bq, "infra_index", infraIndex);

  const investmentRecord = parseCsv(join(SOURCE_DIR, "investment_record.csv")).map(
    (r) => ({ ...r, amount_inr: Number(r.amount_inr) }),
  );
  await loadTable(bq, "investment_record", investmentRecord);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

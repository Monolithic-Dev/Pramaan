// Reproducible reference-data load: reads scripts/seed-demo-data/source/*.csv and
// loads them into BigQuery's jansetu_reference.{admin_regions} and
// jansetu_analytics.{infra_index,investment_record} tables. Source CSVs are
// clearly-labeled realistic sample data (per PRD.md §8), covering 3 states/6
// districts across 2 fiscal years — not live government data, and region_id values
// are placeholder district slugs, not yet real LGD codes (see docs/DATA_MODEL.md's
// AdminRegion entity and docs/BUILD_PLAN.md Day-1 task to source real LGD codes).
// Re-running this script is safe: each table is truncated before reload.
//
// Run: GOOGLE_CLOUD_PROJECT=<project-id> pnpm --filter @jansetu/scripts generate-reference-data
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BigQuery } from "@google-cloud/bigquery";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = join(__dirname, "source");
const REFERENCE_DATASET = "jansetu_reference";
const ANALYTICS_DATASET = "jansetu_analytics";

function parseCsv(path: string): Record<string, string>[] {
  const [headerLine, ...lines] = readFileSync(path, "utf8").trim().split("\n");
  const headers = headerLine.split(",");
  return lines.map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
  });
}

// normalised_value is a 0-1 percentile within the country, computed once here at
// load time — never at query time, or scores stop reproducing as the dataset grows
// (docs/DATA_MODEL.md, InfraIndex entity).
function withNormalisedValue(
  rows: Record<string, unknown>[],
): (Record<string, unknown> & { normalised_value: number })[] {
  const byType = new Map<string, number[]>();
  for (const row of rows) {
    const type = row.index_type as string;
    const values = byType.get(type) ?? [];
    values.push(row.value as number);
    byType.set(type, values);
  }
  for (const values of byType.values()) values.sort((a, b) => a - b);

  return rows.map((row) => {
    const type = row.index_type as string;
    const value = row.value as number;
    const sorted = byType.get(type)!;
    const rank = sorted.filter((v) => v <= value).length;
    const normalised_value = sorted.length > 1 ? rank / sorted.length : 1;
    return { ...row, normalised_value: Number(normalised_value.toFixed(4)) };
  });
}

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

  const adminRegions = parseCsv(join(SOURCE_DIR, "admin_regions.csv")).map((r) => ({
    region_id: r.region_id,
    country_code: r.country_code,
    level: r.level,
    name: r.name,
    parent_region_id: r.parent_region_id || null,
    population: Number(r.population),
    boundary_ref: r.boundary_ref || null,
    centroid_lat: Number(r.centroid_lat),
    centroid_lng: Number(r.centroid_lng),
  }));
  await loadTable(bq, REFERENCE_DATASET, "admin_regions", adminRegions);

  const infraIndexRaw = parseCsv(join(SOURCE_DIR, "infra_index.csv")).map((r) => ({
    ...r,
    value: Number(r.value),
    year: Number(r.year),
  }));
  await loadTable(bq, ANALYTICS_DATASET, "infra_index", withNormalisedValue(infraIndexRaw));

  const investmentRecord = parseCsv(join(SOURCE_DIR, "investment_record.csv")).map((r) => ({
    ...r,
    amount: Number(r.amount),
  }));
  await loadTable(bq, ANALYTICS_DATASET, "investment_record", investmentRecord);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

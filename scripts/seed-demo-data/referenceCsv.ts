// Shared CSV parsing + row shaping for both reference-data loaders (BigQuery and Firestore).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_DIR = join(dirname(fileURLToPath(import.meta.url)), "source");

export function parseCsv(path: string): Record<string, string>[] {
  const [headerLine, ...lines] = readFileSync(path, "utf8").trim().split("\n");
  const headers = headerLine.split(",");
  return lines.map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
  });
}

// normalised_value is a 0-1 percentile *within the country* (docs/DATA_MODEL.md,
// InfraIndex entity — cross-country comparison is meaningless by design, see
// docs/CROSS_BORDER_AND_DPG.md §1), computed once here at load time — never at
// query time, or scores stop reproducing as the dataset grows. Grouping key
// includes country_code so a second country's rows never shift the first
// country's percentiles (or vice versa).
export function withNormalisedValue(
  rows: Record<string, unknown>[],
): (Record<string, unknown> & { normalised_value: number })[] {
  const groupKey = (row: Record<string, unknown>) => `${row.country_code}|${row.index_type}`;
  const byGroup = new Map<string, number[]>();
  for (const row of rows) {
    const values = byGroup.get(groupKey(row)) ?? [];
    values.push(row.value as number);
    byGroup.set(groupKey(row), values);
  }
  for (const values of byGroup.values()) values.sort((a, b) => a - b);

  return rows.map((row) => {
    const value = row.value as number;
    const sorted = byGroup.get(groupKey(row))!;
    const rank = sorted.filter((v) => v <= value).length;
    const normalised_value = sorted.length > 1 ? rank / sorted.length : 1;
    return { ...row, normalised_value: Number(normalised_value.toFixed(4)) };
  });
}


export function loadReferenceRows() {
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
  const infraIndex = withNormalisedValue(
    parseCsv(join(SOURCE_DIR, "infra_index.csv")).map((r) => ({ ...r, value: Number(r.value), year: Number(r.year) })),
  );
  const investmentRecord = parseCsv(join(SOURCE_DIR, "investment_record.csv")).map(
    (r): Record<string, string | number> => ({ ...r, amount: Number(r.amount) }),
  );
  return { adminRegions, infraIndex, investmentRecord };
}

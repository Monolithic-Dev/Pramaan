import type { Firestore } from "firebase-admin/firestore";
import type { AncestryStep, AvailableData, BigQueryAgentClient, InfraIndexRow, InvestmentRow, InvestmentSummary } from "./bigquery.js";

const MAX_ANCESTRY_HOPS = 6;

// Same data as worker-ai-pipeline/src/lib/firestoreReference.ts (ref_* collections), for the
// no-billing stack. Kept separate per service, like the BigQuery clients.
// Reference geography is small and changes only when someone re-seeds it, but the console reads it on
// almost every request (jurisdiction checks, region names). One collection scan is cached briefly and
// answers both the region list and every ancestry lookup, instead of a Firestore read per hop.
const REGION_CACHE_MS = 30_000;

export function createFirestoreAgentClient(db: Firestore): BigQueryAgentClient {
  let cache: { at: number; rows: Record<string, any>[] } | null = null;
  const regionRows = async () => {
    if (!cache || Date.now() - cache.at > REGION_CACHE_MS) {
      const snap = await db.collection("ref_admin_regions").get();
      cache = { at: Date.now(), rows: snap.docs.map((d) => d.data() as Record<string, any>) };
    }
    return cache.rows;
  };

  // The same short cache for the two other small reference tables (a few hundred rows each).
  const tableCache = new Map<string, { at: number; rows: Record<string, unknown>[] }>();
  const cached = async (collection: string) => {
    const hit = tableCache.get(collection);
    if (hit && Date.now() - hit.at <= REGION_CACHE_MS) return hit.rows;
    const rows = (await db.collection(collection).get()).docs.map((d) => d.data());
    tableCache.set(collection, { at: Date.now(), rows });
    return rows;
  };

  return {
    async getAncestryChain(regionId) {
      const byId = new Map((await regionRows()).map((r) => [r.region_id as string, r]));
      const chain: AncestryStep[] = [];
      let current: string | null = regionId;
      for (let i = 0; i < MAX_ANCESTRY_HOPS && current; i++) {
        const row = byId.get(current);
        if (!row) break;
        chain.push({ regionId: current, level: row.level as string });
        current = (row.parent_region_id as string | null) ?? null;
      }
      return chain;
    },

    async listRegions(filter = {}) {
      return (await regionRows())
        .filter((r) => (!filter.level || r.level === filter.level) && (!filter.parentId || r.parent_region_id === filter.parentId) && (!filter.countryCode || r.country_code === filter.countryCode))
        .map((r) => ({
          regionId: r.region_id as string,
          name: r.name as string,
          level: r.level as string,
          parentRegionId: (r.parent_region_id ?? null) as string | null,
          countryCode: r.country_code as string,
          population: r.population as number,
          lat: r.centroid_lat as number,
          lng: r.centroid_lng as number,
        }));
    },

    async getInvestmentRecords(regionId, category) {
      const snap = await db
        .collection("ref_investment_record")
        .where("region_id", "==", regionId)
        .where("category", "==", category)
        .get();
      return (snap.docs.map((d) => d.data()) as InvestmentSummary[]).sort((a, b) =>
        a.fiscal_year < b.fiscal_year ? 1 : -1,
      );
    },

    async getAvailableData(regionId): Promise<AvailableData> {
      const [infra, inv] = await Promise.all([
        db.collection("ref_infra_index").where("region_id", "==", regionId).get(),
        db.collection("ref_investment_record").where("region_id", "==", regionId).get(),
      ]);
      return {
        infraIndexTypes: [...new Set(infra.docs.map((d) => d.data().index_type as string))],
        investmentFiscalYears: [...new Set(inv.docs.map((d) => d.data().fiscal_year as string))],
      };
    },

    async listInvestments() {
      return (await cached("ref_investment_record")) as InvestmentRow[];
    },

    async listInfraIndex() {
      return ((await cached("ref_infra_index")) as InfraIndexRow[]).map((r) => ({
        region_id: r.region_id,
        index_type: r.index_type,
        normalised_value: Number(r.normalised_value),
      }));
    },
  };
}

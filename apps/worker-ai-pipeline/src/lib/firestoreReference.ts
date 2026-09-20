import type { Firestore } from "firebase-admin/firestore";
import type {
  AncestryStep,
  LatestInvestment,
  ReferenceDataClient,
  RegionCentroid,
  RegionInfraData,
} from "./bigquery.js";

const MAX_ANCESTRY_HOPS = 6;

// Reference data in Firestore (ref_* collections, loaded by scripts seed-firestore-reference).
// Works on the free Firebase Spark plan: no BigQuery, no billing account. The dataset is tiny
// (regions, infra indexes, investments), so a Firestore read is the right tool at this scale;
// swap back to BigQuery (REFERENCE_BACKEND=bigquery) for national-scale joins.
export function createFirestoreReferenceDataClient(db: Firestore): ReferenceDataClient {
  async function region(regionId: string) {
    const doc = await db.collection("ref_admin_regions").doc(regionId).get();
    return doc.exists ? (doc.data() as Record<string, unknown>) : null;
  }

  return {
    async getAncestryChain(regionId) {
      const chain: AncestryStep[] = [];
      let current: string | null = regionId;
      for (let i = 0; i < MAX_ANCESTRY_HOPS && current; i++) {
        const row = await region(current);
        if (!row) break;
        chain.push({ regionId: current, level: row.level as string });
        current = (row.parent_region_id as string | null) ?? null;
      }
      return chain;
    },

    async getInfraIndex(regionId): Promise<RegionInfraData | null> {
      const snap = await db.collection("ref_infra_index").where("region_id", "==", regionId).get();
      if (snap.empty) return null;
      const latest = new Map<string, { year: number; value: number }>();
      for (const doc of snap.docs) {
        const d = doc.data();
        const prev = latest.get(d.index_type);
        if (!prev || d.year > prev.year) latest.set(d.index_type, { year: d.year, value: d.normalised_value });
      }
      return { normalisedValuesByType: Object.fromEntries([...latest].map(([k, v]) => [k, v.value])) };
    },

    async getLatestInvestment(regionId, category): Promise<LatestInvestment | null> {
      const snap = await db
        .collection("ref_investment_record")
        .where("region_id", "==", regionId)
        .where("category", "==", category)
        .get();
      const years = snap.docs.map((d) => d.data().fiscal_year as string).sort().reverse();
      return years[0] ? { fiscalYear: years[0] } : null;
    },

    async getAllRegionCentroids(): Promise<RegionCentroid[]> {
      const snap = await db.collection("ref_admin_regions").get();
      return snap.docs.map((doc) => {
        const r = doc.data();
        return {
          regionId: r.region_id,
          countryCode: r.country_code,
          level: r.level,
          parentRegionId: r.parent_region_id ?? null,
          lat: r.centroid_lat,
          lng: r.centroid_lng,
          population: r.population,
        };
      });
    },

    async getRegionPopulation(regionId) {
      const row = await region(regionId);
      return row ? (row.population as number) : null;
    },
  };
}

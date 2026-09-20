import type { Firestore } from "firebase-admin/firestore";
import type { AncestryStep, AvailableData, BigQueryAgentClient, InvestmentSummary } from "./bigquery.js";

const MAX_ANCESTRY_HOPS = 6;

// Same data as worker-ai-pipeline/src/lib/firestoreReference.ts (ref_* collections), for the
// no-billing stack. Kept separate per service, like the BigQuery clients.
export function createFirestoreAgentClient(db: Firestore): BigQueryAgentClient {
  return {
    async getAncestryChain(regionId) {
      const chain: AncestryStep[] = [];
      let current: string | null = regionId;
      for (let i = 0; i < MAX_ANCESTRY_HOPS && current; i++) {
        const doc = await db.collection("ref_admin_regions").doc(current).get();
        if (!doc.exists) break;
        const row = doc.data() as { level: string; parent_region_id: string | null };
        chain.push({ regionId: current, level: row.level });
        current = row.parent_region_id ?? null;
      }
      return chain;
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
  };
}

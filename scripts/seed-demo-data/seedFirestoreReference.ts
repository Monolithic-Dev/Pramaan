// Loads the same sample reference data into Firestore (ref_* collections) for the free,
// no-billing deployment. Safe to re-run: documents are keyed deterministically and overwritten.
//
// Run: FIREBASE_SERVICE_ACCOUNT_JSON=<json|base64> pnpm --filter @jansetu/scripts seed-firestore-reference
//  or: gcloud auth application-default login, then GCP_PROJECT_ID=<id> pnpm ... seed-firestore-reference
import { getFirestore } from "firebase-admin/firestore";
import { initFirebase } from "../lib/firebase.js";
import { loadReferenceRows } from "./referenceCsv.js";

initFirebase();
const db = getFirestore();

async function write(collection: string, docs: [string, object][]) {
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    for (const [id, data] of docs.slice(i, i + 400)) batch.set(db.collection(collection).doc(id), data);
    await batch.commit();
  }
  console.log(`wrote ${docs.length} docs to ${collection}`);
}

const { adminRegions, infraIndex, investmentRecord } = loadReferenceRows();
await write("ref_admin_regions", adminRegions.map((r) => [r.region_id, r]));
await write("ref_infra_index", infraIndex.map((r) => [`${r.region_id}__${r.index_type}__${r.year}`, r]));
await write("ref_investment_record", investmentRecord.map((r) => [String(r.investment_id), r]));

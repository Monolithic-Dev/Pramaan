// End-to-end smoke test of the whole running stack against the Firebase emulators, using the REAL worker
// and real Gemini: three citizens report the same problem in different words, the pipeline understands,
// merges and scores it, officers assign and fund it, the citizens confirm the fix, and the issue resolves.
// It cleans up everything it creates, so it is safe to run against the seeded demo data.
//
// Needs: emulators + worker (:8081) + gateway (:8080) running, reference data and demo data seeded.
// Run (from scripts/): FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//   FIREBASE_PROJECT_ID=pramaan-a0c00 WORKER_SHARED_SECRET=localsecret ./node_modules/.bin/tsx smoke-emulator.ts
import { randomUUID } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initFirebase } from "./lib/firebase.js";

const API = process.env.API_URL ?? "http://localhost:8080/v1";
const WORKER = process.env.WORKER_URL ?? "http://localhost:8081";
const WORKER_SECRET = process.env.WORKER_SHARED_SECRET ?? "";
const AUTH = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099"}`;
const OFFICER_PASSWORD = "DemoAdmin!2026";

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("This smoke test is for the emulators: set FIRESTORE_EMULATOR_HOST.");
initFirebase();
const db = getFirestore();
const admin = getAuth();

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = "") {
  if (ok) passed += 1;
  else failures.push(name);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  -> ${detail}` : ""}`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until<T>(what: string, fn: () => Promise<T | null | false | undefined>, ms = 150_000): Promise<T | null> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await fn().catch(() => null);
    if (v) return v;
    await sleep(2500);
  }
  console.log(`  (timed out waiting for ${what})`);
  return null;
}

async function identity(kind: "signUp" | "signInWithPassword", email: string, password: string) {
  const res = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:${kind}?key=fake`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const json = (await res.json()) as { idToken?: string; localId?: string };
  if (!json.idToken) throw new Error(`${kind} failed for ${email}: ${JSON.stringify(json)}`);
  return { token: json.idToken, uid: json.localId! };
}

async function call(token: string | null, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON (CSV etc.) */
  }
  return { status: res.status, json, text };
}

async function main() {
  const stamp = Date.now();
  const created = { uids: [] as string[], submissionIds: [] as string[], issueId: "", projectId: "", extraIssueIds: [] as string[], extraProjectIds: [] as string[] };

  // ---- 0. The stack is up and has data -------------------------------------------------------------------
  const health = await fetch(`${API.replace("/v1", "")}/healthz`).then((r) => r.status).catch(() => 0);
  check("gateway healthy", health === 200);
  const overview = await call(null, "GET", "/public/overview");
  check("public overview has data", overview.json?.status === "ok", `${overview.json?.totals?.issues} issues`);
  const cards = await call(null, "GET", "/public/scorecards?group=district");
  const graded = (cards.json?.scorecards ?? []).filter((c: any) => c.status === "ok");
  check("public scorecards are graded", graded.length > 5 && new Set(graded.map((c: any) => c.grade)).size >= 2, `${graded.length} districts, grades ${[...new Set(graded.map((c: any) => c.grade))].join("")}`);
  check("open data CSV downloads", (await call(null, "GET", "/public/opendata/issues.csv")).text.startsWith("state,district"));

  // ---- 1. Three citizens report the same pothole, in different words and languages ---------------------
  const reports = [
    { text: "There is a big dangerous pothole on the main road near Karol Bagh metro station, bikes keep slipping.", lat: 28.6519, lng: 77.2315 },
    { text: "करोल बाग मेट्रो स्टेशन के पास सड़क पर बहुत बड़ा गड्ढा है, हादसे हो रहे हैं।", lat: 28.65195, lng: 77.23155 },
    { text: "Huge pothole in the road next to Karol Bagh metro, very unsafe for two wheelers and autos.", lat: 28.65192, lng: 77.23148 },
  ];
  const citizens: { token: string; uid: string; submissionId: string; code: string }[] = [];
  for (const [i, r] of reports.entries()) {
    const { token, uid } = await identity("signUp", `smoke-${stamp}-${i}@example.com`, "SmokeTest!2026");
    created.uids.push(uid);
    await call(token, "POST", "/auth/session", { preferred_language: i === 1 ? "hi-IN" : "en-IN" });
    const sub = await call(token, "POST", "/submissions", { channel: "web", text: r.text, lat: r.lat, lng: r.lng, consent_version: "dpdp-notice-v1", country_code: "IN" }, { "idempotency-key": randomUUID() });
    const ok = sub.status === 202 && Boolean(sub.json?.tracking_code);
    check(`citizen ${i + 1} submitted and got a tracking code`, ok, sub.json?.tracking_code ?? String(sub.status));
    citizens.push({ token, uid, submissionId: sub.json?.submission_id, code: sub.json?.tracking_code });
    created.submissionIds.push(sub.json?.submission_id);
  }

  // ---- 2. The AI pipeline understands, locates and merges them ------------------------------------------
  console.log("Waiting for the worker (Gemini) to process the reports...");
  const issueId = await until("all three reports to join one issue", async () => {
    const subs = await Promise.all(citizens.map((c) => call(c.token, "GET", `/submissions/${c.submissionId}`)));
    const ids = subs.map((s) => s.json?.issue_id as string | null);
    return ids.every(Boolean) && new Set(ids).size === 1 ? ids[0] : null;
  });
  check("the worker merged the three reports (in two languages) into ONE issue", Boolean(issueId), issueId ?? "not merged");
  if (!issueId) return;
  created.issueId = issueId;

  const tracked = await call(null, "GET", `/public/track/${citizens[0].code.toLowerCase()}`);
  check("anyone can track a report with its code (no login)", tracked.status === 200 && tracked.json?.stage === "understood" && Boolean(tracked.json?.category), `${tracked.json?.category}, ${tracked.json?.other_reporters} others`);
  check("the tracker exposes no report text or identity", !/pothole|Karol|citizen_id/i.test(tracked.text));

  const scoring = await fetch(`${WORKER}/jobs/score?country=IN`, { method: "POST", headers: WORKER_SECRET ? { "x-worker-secret": WORKER_SECRET } : {} });
  check("scoring job runs", scoring.ok);

  // ---- 3. Officers work the issue ----------------------------------------------------------------------------
  const collector = await identity("signInWithPassword", "collector@pramaan.demo", OFFICER_PASSWORD);
  const field = await identity("signInWithPassword", "field@pramaan.demo", OFFICER_PASSWORD);
  const detail = await call(collector.token, "GET", `/issues/${issueId}`);
  check("collector can open the issue with 3 reports and a score", detail.status === 200 && detail.json?.reports?.length === 3 && detail.json?.score?.composite_score > 0, `score ${detail.json?.score?.composite_score?.toFixed?.(2)}`);
  check("the Hindi report carries an English translation", (detail.json?.reports ?? []).some((r: any) => r.translated_text));

  const outsider = await identity("signInWithPassword", "maharashtra@pramaan.demo", OFFICER_PASSWORD);
  check("an officer from another state is refused (jurisdiction)", (await call(outsider.token, "GET", `/issues/${issueId}`)).status === 403);
  check("a field officer cannot change status (role)", (await call(field.token, "POST", `/issues/${issueId}/status`, { status: "verified", justification: "smoke test" })).status === 403);

  const verified = await call(collector.token, "POST", `/issues/${issueId}/status`, { status: "verified", justification: "Verified in the smoke test" });
  check("collector verifies the issue", verified.status === 200);
  const citizenInbox = await call(citizens[0].token, "GET", "/notifications");
  check("the reporting citizen is notified", citizenInbox.json?.notifications?.some((n: any) => n.kind === "issue.status_changed" && n.params?.status === "verified"));

  const assigned = await call(collector.token, "POST", `/issues/${issueId}/assign`, { officer_uid: field.uid, due_in_days: 5 });
  check("collector assigns it to the field officer with a deadline", assigned.status === 200);
  check("the field officer is notified of the assignment", (await call(field.token, "GET", "/notifications")).json?.notifications?.some((n: any) => n.kind === "issue.assigned" && n.link.endsWith(issueId)));
  check("field officer adds an internal note", (await call(field.token, "POST", `/issues/${issueId}/comments`, { body: "Site visited, pothole is 40 cm wide." })).status === 201);
  const queue = await call(field.token, "GET", "/issues?assigned=me");
  check("it appears in the field officer's queue", queue.json?.issues?.some((i: any) => i.issue_id === issueId));

  const schemes = await call(collector.token, "GET", `/issues/${issueId}/schemes`);
  check("scheme matcher suggests a funding route", schemes.json?.matches?.length > 0, schemes.json?.matches?.[0]?.scheme?.short);
  const optimised = await call(collector.token, "POST", "/planner/optimize", { budget_inr: 3_000_000, min_vulnerable_share: 0.2 });
  check("budget optimiser returns a plan within budget", optimised.status === 200 && optimised.json?.plan?.cost_inr <= 3_000_000, `${optimised.json?.plan?.items?.length} issues`);
  check("weekly briefing is generated", (await call(collector.token, "GET", "/reports/briefing")).json?.narrative?.text?.length > 40);

  const supporter = await identity("signUp", `smoke-${stamp}-s@example.com`, "SmokeTest!2026");
  created.uids.push(supporter.uid);
  await call(supporter.token, "POST", "/auth/session", {});
  const supported = await call(supporter.token, "POST", `/issues/${issueId}/support`);
  check("a neighbour can say 'I'm affected too' (once)", supported.json?.support_count === 1 && (await call(supporter.token, "POST", `/issues/${issueId}/support`)).json?.already_supported === true);

  // ---- 4. Fund it and close the loop with citizen confirmation ------------------------------------------------
  const project = await call(collector.token, "POST", `/issues/${issueId}/project`, {});
  check("collector recommends a project with a grounded brief", project.status === 201 && project.json?.groundedness_check?.passed === true, project.json?.assigned_dept);
  created.projectId = project.json?.project_id;
  check("project is funded", (await call(collector.token, "POST", `/projects/${created.projectId}/status`, { status: "funded" })).status === 200);
  check("project starts", (await call(collector.token, "POST", `/projects/${created.projectId}/status`, { status: "in_progress" })).status === 200);
  check("the citizen is told it was funded", (await call(citizens[1].token, "GET", "/notifications")).json?.notifications?.some((n: any) => n.kind === "issue.funded"));

  check("officer marks the work complete", (await call(collector.token, "POST", `/projects/${created.projectId}/mark-complete`, {})).status === 200);
  check("reporters are asked to confirm the fix", (await call(citizens[2].token, "GET", "/notifications")).json?.notifications?.some((n: any) => n.kind === "issue.confirm_resolution"));
  for (const [i, c] of citizens.entries()) {
    const r = await call(c.token, "POST", `/projects/${created.projectId}/confirm-resolution`, { confirmed: true });
    check(`citizen ${i + 1} confirms the fix`, r.status === 200);
  }
  check("a bystander cannot confirm a fix they never reported", (await call(supporter.token, "POST", `/projects/${created.projectId}/confirm-resolution`, { confirmed: true })).status === 403);
  const stillOpen = await call(collector.token, "GET", `/issues/${issueId}`);
  check("3 confirmations alone do NOT resolve it (needs officer sign-off)", stillOpen.json?.issue?.status !== "resolved", stillOpen.json?.issue?.status);
  check("officer signs off", (await call(collector.token, "POST", `/projects/${created.projectId}/officer-signoff`, {})).status === 200);
  const done = await call(collector.token, "GET", `/issues/${issueId}`);
  check("the issue is now RESOLVED", done.json?.issue?.status === "resolved");
  check("the citizen tracker shows 'fixed'", (await call(null, "GET", `/public/track/${citizens[0].code}`)).json?.stage === "fixed");
  check("citizens are told it is resolved", (await call(citizens[0].token, "GET", "/notifications")).json?.notifications?.some((n: any) => n.kind === "issue.status_changed" && n.params?.status === "resolved"));
  const impact = await call(collector.token, "GET", "/analytics/impact");
  check("impact ledger reflects real resolutions", impact.json?.resolved > 0 && impact.json?.people_benefited > 0, `${impact.json?.people_benefited} people`);
  check("audit log records the officer actions", (await call((await identity("signInWithPassword", "admin@pramaan.demo", OFFICER_PASSWORD)).token, "GET", "/admin/audit")).json?.entries?.some((e: any) => e.target_id === issueId));

  // ---- 5. No account, no smartphone: an anonymous reporter closes (and reopens) the loop by code -------------------
  const anonSpot = { lat: 28.5245, lng: 77.2066 }; // South Delhi
  const anon = await call(null, "POST", "/submissions", { channel: "web", text: "The streetlights on Aurobindo Marg have been off for three weeks, it is dark and unsafe for women walking home.", ...anonSpot, consent_version: "dpdp-notice-v1", country_code: "IN" }, { "idempotency-key": randomUUID() });
  check("an anonymous citizen can report and gets a tracking code", anon.status === 202 && Boolean(anon.json?.tracking_code), anon.json?.tracking_code);
  created.submissionIds.push(anon.json?.submission_id);
  const anonCode: string = anon.json?.tracking_code;
  const anonIssueId = await until("the anonymous report to be processed", async () => {
    const s = await db.collection("submissions").doc(anon.json?.submission_id).get();
    return (s.data()?.issue_id as string | undefined) ?? null;
  });
  check("the worker processed the anonymous report", Boolean(anonIssueId), anonIssueId ?? "not processed");
  if (anonIssueId) {
    created.extraIssueIds.push(anonIssueId);
    const nearby = await call(null, "GET", `/public/nearby?lat=${anonSpot.lat}&lng=${anonSpot.lng}&radius=500`);
    check("'is this already reported?' finds it for the next person at that spot", nearby.json?.issues?.some((i: any) => i.issue_id === anonIssueId), `${nearby.json?.issues?.length} nearby`);

    const southCollector = collector; // Central Delhi collector's jurisdiction does not cover South Delhi:
    check("a district collector cannot touch another district's issue", (await call(southCollector.token, "GET", `/issues/${anonIssueId}`)).status === 403);
    const delhiAdmin = await identity("signInWithPassword", "admin@pramaan.demo", OFFICER_PASSWORD);
    const override = await call(delhiAdmin.token, "POST", `/issues/${anonIssueId}/emergency-override`, { enabled: true, justification: "Unlit road, safety risk for women" });
    check("state admin applies an emergency override to a single-reporter safety issue", override.status === 200);
    await fetch(`${WORKER}/jobs/score?country=IN`, { method: "POST", headers: WORKER_SECRET ? { "x-worker-secret": WORKER_SECRET } : {} });
    await call(delhiAdmin.token, "POST", `/issues/${anonIssueId}/assign`, { officer_uid: delhiAdmin.uid });
    const anonProject = await call(delhiAdmin.token, "POST", `/issues/${anonIssueId}/project`, {});
    check("the overridden issue is scored and gets a project", anonProject.status === 201, anonProject.json?.assigned_dept);
    const anonProjectId: string = anonProject.json?.project_id;
    created.extraProjectIds.push(anonProjectId);
    await call(delhiAdmin.token, "POST", `/projects/${anonProjectId}/status`, { status: "in_progress" });
    await call(delhiAdmin.token, "POST", `/projects/${anonProjectId}/mark-complete`, {});
    check("the anonymous reporter is asked to confirm, on the tracker", (await call(null, "GET", `/public/track/${anonCode}`)).json?.awaiting_confirmation === true);

    const rejected = await call(null, "POST", `/public/track/${anonCode}/confirm`, { confirmed: false });
    check("the reporter says 'not fixed' with just the code", rejected.status === 200, JSON.stringify(rejected.json));
    const afterReject = await call(null, "GET", `/public/track/${anonCode}`);
    check("a 'not fixed' answer REOPENS the work instead of closing it", afterReject.json?.reopened_count === 1 && afterReject.json?.issue_status === "in_progress", `reopened ${afterReject.json?.reopened_count}, status ${afterReject.json?.issue_status}`);
    check("the officer handling it is told it was reopened", (await call(delhiAdmin.token, "GET", "/notifications")).json?.notifications?.some((n: any) => n.kind === "issue.reopened" && n.link.endsWith(anonIssueId)));

    await call(delhiAdmin.token, "POST", `/projects/${anonProjectId}/mark-complete`, {});
    check("after the real fix, the reporter confirms by code", (await call(null, "POST", `/public/track/${anonCode}/confirm`, { confirmed: true })).status === 200);
    check("the same code cannot vote twice in a round", (await call(null, "POST", `/public/track/${anonCode}/confirm`, { confirmed: true })).status !== 200);
    await call(delhiAdmin.token, "POST", `/projects/${anonProjectId}/officer-signoff`, {});
    check("confirmation + sign-off resolves the anonymous report", (await call(null, "GET", `/public/track/${anonCode}`)).json?.stage === "fixed");
  }

  // ---- 6. Deadlines escalate up the chain ------------------------------------------------------------------------
  const escId = `smoke_esc_${stamp}`;
  created.extraIssueIds.push(escId);
  await db.collection("issues").doc(escId).set({
    issue_id: escId, country_code: "IN", state_id: "IN-DL", category: "water", subcategory: "no drinking water supply",
    canonical_description: "Smoke test: no water supply for weeks", embedding: null, embedding_model: null, geo_cluster_id: escId,
    admin_region_id: "dl-central-delhi", geohash: null, centroid_lat: 28.65, centroid_lng: 77.23, submission_ids: [], report_count: 5,
    distinct_reporter_count: 5, first_reported_at: new Date(Date.now() - 60 * 86_400_000).toISOString(), last_reported_at: new Date().toISOString(),
    emergency_override: false, fraud_flags: [], status: "open", composite_score: 0.8, latest_score_id: null,
  });
  check("the escalation job refuses callers without the secret", (await call(null, "POST", "/jobs/escalations")).status === 401);
  const esc = await call(null, "POST", "/jobs/escalations", undefined, { "x-worker-secret": WORKER_SECRET });
  check("the escalation job runs", esc.status === 200 && esc.json?.escalated > 0, `${esc.json?.escalated} escalated, ${esc.json?.notified} notified`);
  const escalatedTo = (await db.collection("issues").doc(escId).get()).data()?.escalation_notified;
  check("an issue 53 days past a 7-day deadline goes all the way to the state admin (level 2)", escalatedTo === 2, `level ${escalatedTo}`);
  const again = await call(null, "POST", "/jobs/escalations", undefined, { "x-worker-secret": WORKER_SECRET });
  check("escalation is not repeated on the next run", again.json?.escalated === 0, `${again.json?.escalated} on rerun`);

  // ---- 7. Messaging channels are locked down -----------------------------------------------------------------------
  const hook = { from: "+919800000000", message_id: `smoke-${stamp}`, text: "Smoke test message", location_text: "Karol Bagh, Delhi" };
  check("the WhatsApp webhook rejects a caller without the provider secret", (await call(null, "POST", "/webhooks/whatsapp", hook)).status === 401);

  // ---- cleanup ---------------------------------------------------------------------------------------------------
  console.log("Cleaning up test data...");
  const del = async (col: string, id: string | undefined) => id && db.collection(col).doc(id).delete().catch(() => undefined);
  for (const id of created.extraIssueIds) await del("issues", id);
  for (const id of created.extraProjectIds) {
    await del("projects", id);
    await del("impactRecords", id);
  }
  for (const col of ["auditLog", "priorityScores", "notifications"]) {
    const snap = await db.collection(col).get();
    const ids = [...created.extraIssueIds, ...created.extraProjectIds].filter(Boolean);
    await Promise.all(snap.docs.filter((d) => ids.some((id) => JSON.stringify(d.data()).includes(id))).map((d) => d.ref.delete()));
  }
  await del("issues", created.issueId);
  await del("projects", created.projectId);
  await del("impactRecords", created.projectId);
  await Promise.all(created.submissionIds.map((id) => del("submissions", id)));
  for (const uid of created.uids) {
    for (const col of ["notifications", "citizens"]) {
      const snap = await db.collection(col).where(col === "citizens" ? "citizen_id" : "recipient_id", "==", uid).get();
      await Promise.all(snap.docs.map((d) => d.ref.delete()));
    }
    await admin.deleteUser(uid).catch(() => undefined);
  }
  for (const col of ["auditLog", "issueComments", "priorityScores"]) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.filter((d) => JSON.stringify(d.data()).includes(created.issueId) || JSON.stringify(d.data()).includes(created.projectId)).map((d) => d.ref.delete()));
  }
  for (const c of citizens) await db.collection("issueSupports").doc(`${created.issueId}_${supporter.uid}`).delete().catch(() => c);
  // Assigned-officer notification from the assignment step.
  for (const uid of [field.uid, collector.uid]) {
    const snap = await db.collection("notifications").where("recipient_id", "==", uid).get();
    await Promise.all(snap.docs.filter((d) => JSON.stringify(d.data()).includes(created.issueId)).map((d) => d.ref.delete()));
  }
}

main()
  .catch((err) => {
    failures.push(`crashed: ${err instanceof Error ? err.message : String(err)}`);
    console.error(err);
  })
  .finally(() => {
    console.log(`\n${passed} passed, ${failures.length} failed${failures.length ? `: ${failures.join("; ")}` : ""}`);
    process.exit(failures.length ? 1 : 0);
  });

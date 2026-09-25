// Seeds a realistic, clearly-labelled demo dataset: ~350 issues and ~1,500 citizen reports across India
// and Brazil (in 10 languages), then runs the REAL scoring engine on them through the worker, then adds
// workflow history on top: verification, projects, funding, completion with citizen confirmation, an audit
// trail, assignments, officer notes, notifications, budget plans, and demo logins.
//
// Every issue carries is_synthetic: true and the UI badges it as illustrative sample data. All demo document
// ids start with "dm_", so re-running cleans the previous demo data first and never touches real reports.
//
// Needs: reference data seeded (seedFirestoreReference.ts) and the worker running (for scoring).
// Run:   ./node_modules/.bin/tsx seed-demo-data/seedDemoData.ts [--clean-only]
//   env: FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST (or real credentials), FIREBASE_PROJECT_ID,
//        WORKER_URL (default http://127.0.0.1:8081), WORKER_SHARED_SECRET
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type { BudgetPlan, Citizen, ImpactRecord, Issue, IssueComment, Notification, PriorityScore, Project, Submission } from "@jansetu/shared-types";
import { geohashEncode } from "@jansetu/shared-utils";
import { initFirebase } from "../lib/firebase.js";
import { AUDIT_REASONS, BRAZIL_LANGUAGES, OFFICER_NOTES, STATE_LANGUAGES, TEMPLATES, TEMPLATES_BY_CATEGORY, type Category, type Template } from "./demoContent.js";

initFirebase();
const db = getFirestore();
const auth = getAuth();
db.settings({ ignoreUndefinedProperties: true });

const HERE = dirname(fileURLToPath(import.meta.url));
const BANK: Record<string, Record<string, string[]>> = JSON.parse(readFileSync(join(HERE, "demoContent.i18n.json"), "utf8"));
const WORKER_URL = process.env.WORKER_URL ?? "http://127.0.0.1:8081";
const WORKER_SECRET = process.env.WORKER_SHARED_SECRET ?? "";
const PASSWORD = "DemoAdmin!2026";
const CITIZEN_PASSWORD = "DemoCitizen!2026";
const DAY = 86_400_000;
const NOW = Date.now();
const DEMO_TRACKING_CODE = "JS-K7M3P9QD";

// ---------- helpers ----------------------------------------------------------------------------------

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260925);
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
function weighted<T>(items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) if ((r -= weights[i]) <= 0) return items[i];
  return items[items.length - 1];
}
const iso = (ms: number) => new Date(ms).toISOString();
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const trackingCode = () => `JS-${[...randomBytes(8)].map((b) => ALPHABET[b % ALPHABET.length]).join("")}`;

async function writeAll(collection: string, docs: { id: string; data: object }[]) {
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    for (const d of docs.slice(i, i + 400)) batch.set(db.collection(collection).doc(d.id), d.data);
    await batch.commit();
  }
  console.log(`  ${collection}: ${docs.length}`);
}

async function deleteWhere(collection: string, match: (id: string) => boolean) {
  const refs = (await db.collection(collection).listDocuments()).filter((r) => match(r.id));
  for (let i = 0; i < refs.length; i += 400) {
    const batch = db.batch();
    for (const r of refs.slice(i, i + 400)) batch.delete(r);
    await batch.commit();
  }
  return refs.length;
}

// ---------- demo accounts ---------------------------------------------------------------------------

interface Account { key: string; email: string; role: "state_admin" | "district_collector" | "field_officer"; region: string; country: string }
const ACCOUNTS: Account[] = [
  { key: "national", email: "national@jansetu.demo", role: "state_admin", region: "IN", country: "IN" },
  { key: "delhi", email: "admin@jansetu.demo", role: "state_admin", region: "IN-DL", country: "IN" },
  { key: "delhiCollector", email: "collector@jansetu.demo", role: "district_collector", region: "dl-central-delhi", country: "IN" },
  { key: "delhiField", email: "field@jansetu.demo", role: "field_officer", region: "dl-central-delhi", country: "IN" },
  { key: "maha", email: "maharashtra@jansetu.demo", role: "state_admin", region: "IN-MH", country: "IN" },
  { key: "mumbai", email: "mumbai@jansetu.demo", role: "district_collector", region: "mh-mumbai-city", country: "IN" },
  { key: "karnataka", email: "karnataka@jansetu.demo", role: "state_admin", region: "IN-KA", country: "IN" },
  { key: "tn", email: "tamilnadu@jansetu.demo", role: "state_admin", region: "IN-TN", country: "IN" },
  { key: "brasil", email: "brasil@jansetu.demo", role: "state_admin", region: "BR-SP", country: "BR" },
];

async function ensureUser(email: string, password: string, claims: Record<string, unknown> | null): Promise<string> {
  let user = await auth.getUserByEmail(email).catch(() => null);
  if (!user) user = await auth.createUser({ email, password, emailVerified: true });
  else await auth.updateUser(user.uid, { password, disabled: false });
  await auth.setCustomUserClaims(user.uid, claims);
  return user.uid;
}

// ---------- clean -----------------------------------------------------------------------------------

async function clean(demoUids: string[]) {
  console.log("Cleaning previous demo data...");
  // "demo-" ids are from the first version of this seeder; removing them too means re-running always ends clean.
  for (const c of ["issues", "submissions", "priorityScores", "projects", "impactRecords", "auditLog", "issueComments", "notifications", "budgetPlans", "issueSupports"]) {
    const n = await deleteWhere(c, (id) => id.includes("dm_") || id.includes("demo-"));
    if (n) console.log(`  removed ${n} from ${c}`);
  }
  const legacyAudit = await db.collection("auditLog").where("actor_id", "==", "seed-script").get();
  await Promise.all(legacyAudit.docs.map((d) => d.ref.delete()));
  // Notifications created by the running app for demo users, and the demo citizen's record.
  for (const uid of demoUids) {
    const snap = await db.collection("notifications").where("recipient_id", "==", uid).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  const citizens = await db.collection("citizens").where("phone_hash", "==", "demo").get();
  await Promise.all(citizens.docs.map((d) => d.ref.delete()));
}

// ---------- main ------------------------------------------------------------------------------------

interface Region { region_id: string; name: string; level: string; parent_region_id: string | null; country_code: string; population: number; centroid_lat: number; centroid_lng: number }

const BASE_BUDGET: Record<string, number> = { roads: 500_000, water: 750_000, electricity: 400_000, sanitation: 600_000, health_infra: 900_000, education_infra: 800_000, other: 300_000 };
const DEPARTMENT: Record<string, string> = {
  roads: "Public Works Department", water: "Water Supply & Sewerage Board", electricity: "Electricity Distribution Company",
  sanitation: "Municipal Sanitation Department", health_infra: "Health & Family Welfare Department", education_infra: "Education Department", other: "District Administration",
};
const LOCALITIES = ["Gandhi Nagar", "Nehru Colony", "Station Road", "Main Market", "Ward 4", "Ward 11", "Shivaji Chowk", "Temple Street", "Old Town", "New Extension", "Bus Stand Road", "Lake View Colony", "Subhash Nagar", "Railway Colony", "Govt. School Road"];

const FLAGSHIP: Record<string, number> = {
  "dl-central-delhi": 26, "dl-south-delhi": 22, "mh-mumbai-city": 18, "mh-pune": 14, "ka-bengaluru-urban": 18, "ka-mysuru": 9,
  "tn-chennai": 14, "br-sao-paulo": 16, "br-campinas": 8, "br-santos": 8,
};
const CATEGORY_WEIGHTS: Record<Category, number> = { roads: 22, water: 22, electricity: 12, sanitation: 20, health_infra: 9, education_infra: 9, other: 6 };

async function main() {
  const cleanOnly = process.argv.includes("--clean-only");

  const regions = (await db.collection("ref_admin_regions").get()).docs.map((d) => d.data() as Region);
  if (regions.length === 0) throw new Error("No reference regions found. Run seedFirestoreReference.ts first.");
  const byId = new Map(regions.map((r) => [r.region_id, r]));
  const stateOf = (r: Region): string => {
    let cur: Region | undefined = r;
    while (cur && cur.level !== "state" && cur.level !== "estado") cur = cur.parent_region_id ? byId.get(cur.parent_region_id) : undefined;
    return cur?.region_id ?? "UNRESOLVED";
  };

  // Accounts first: audit entries and assignments need real uids.
  console.log("Creating demo accounts...");
  const uid: Record<string, string> = {};
  for (const a of ACCOUNTS) uid[a.key] = await ensureUser(a.email, PASSWORD, { role: a.role, region_id: a.region, country_code: a.country });
  const citizenUid = await ensureUser("citizen@jansetu.demo", CITIZEN_PASSWORD, null);
  await clean([...Object.values(uid), citizenUid]);
  if (cleanOnly) return console.log("Clean only: done.");

  const label = (a: Account) => a.email;
  const accountByKey = new Map(ACCOUNTS.map((a) => [a.key, a]));
  /** The officer who would plausibly act on an issue: district collector if one exists, else the state admin, else national. */
  const actorFor = (regionId: string, stateId: string): { uid: string; label: string } => {
    const district = ACCOUNTS.find((a) => a.role === "district_collector" && a.region === regionId);
    const state = ACCOUNTS.find((a) => a.role === "state_admin" && a.region === stateId);
    const chosen = district ?? state ?? accountByKey.get("national")!;
    return { uid: uid[chosen.key], label: label(chosen) };
  };

  // ---- Phase A: raw issues and reports ----------------------------------------------------------------
  console.log("Generating issues and reports...");
  const leaves = regions.filter((r) => r.level === "district" || r.level === "município");
  interface Draft { issue: Issue; subs: Submission[]; template: Template; region: Region; state: string }
  const drafts: Draft[] = [];
  let issueN = 0;
  let subN = 0;

  const monthsBack = (m: number, day = 12) => {
    const d = new Date(NOW);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - m, day, 9, Math.floor(rand() * 60));
  };

  function makeIssue(region: Region, template: Template, firstMs: number, opts: { forceScored?: boolean } = {}) {
    issueN += 1;
    const state = stateOf(region);
    const isBrazil = region.country_code === "BR";
    const langs = isBrazil ? BRAZIL_LANGUAGES : STATE_LANGUAGES[state.replace("IN-", "")] ?? ["hi", "en"];
    const ageDays = (NOW - firstMs) / DAY;

    // Long-standing problems attract more people; a few issues are single-reporter or emergencies.
    const u = rand();
    let distinct = opts.forceScored ? 3 + Math.floor(rand() * 4) : 1 + Math.floor(-Math.log(1 - u) * (2.4 + Math.min(ageDays, 300) / 150));
    distinct = Math.min(distinct, 16);
    const reports = Math.min(distinct + Math.floor(rand() * distinct * 0.4), 18);
    const emergency = Boolean(template.hazard) && rand() < 0.45;
    const fraud = !emergency && rand() < 0.03 ? [pick(["burst_detected", "geofence_mismatch", "photo_implausible"])] : [];

    const lat = region.centroid_lat + between(-0.04, 0.04);
    const lng = region.centroid_lng + between(-0.04, 0.04);
    const lastMs = Math.min(NOW - 3_600_000, firstMs + Math.min(ageDays, between(2, 40)) * DAY);
    const id = `dm_iss_${String(issueN).padStart(4, "0")}`;

    const subs: Submission[] = [];
    for (let k = 0; k < reports; k++) {
      subN += 1;
      const lang = weighted(langs, langs.map((_, i) => (i === 0 ? 65 : 35 / Math.max(1, langs.length - 1))));
      const idx = k % template.reports.length;
      const english = template.reports[idx];
      const text = lang === "en" ? english : BANK[template.id]?.[lang]?.[idx] ?? english;
      const at = k === 0 ? firstMs : firstMs + (lastMs - firstMs) * rand();
      const locality = pick(LOCALITIES);
      subs.push({
        submission_id: `dm_sub_${String(subN).padStart(5, "0")}`,
        idempotency_key: `dm_idem_${subN}`,
        citizen_id: `dm_cit_${issueN}_${k % distinct}`,
        country_code: region.country_code,
        channel: weighted(["web", "voice", "whatsapp", "sms"] as const, [50, 22, 16, 12]),
        raw_text: text,
        raw_audio_url: null,
        photo_url: null,
        detected_language: lang,
        translated_text: lang === "en" ? null : english,
        pii_scrubbed_text: text,
        lat: lat + between(-0.004, 0.004),
        lng: lng + between(-0.004, 0.004),
        location_text: `${locality}, ${region.name}`,
        location_confidence: "high",
        geohash: geohashEncode(lat, lng, 6),
        resolved_region_id: region.region_id,
        state_id: state,
        issue_id: id,
        submitted_at: iso(at),
        status: "processed",
        processing_error: null,
        submitter_ip_hash: null,
        tracking_code: trackingCode(),
      });
    }
    subs.sort((a, b) => (a.submitted_at < b.submitted_at ? -1 : 1));

    const issue: Issue = {
      issue_id: id, country_code: region.country_code, state_id: state, category: template.category, subcategory: template.subcategory,
      canonical_description: template.canonical, embedding: null, embedding_model: null, geo_cluster_id: `dm_cl_${issueN}`,
      admin_region_id: region.region_id, geohash: geohashEncode(lat, lng, 6), centroid_lat: lat, centroid_lng: lng, is_synthetic: true,
      support_count: 0, submission_ids: subs.map((s) => s.submission_id), report_count: reports, distinct_reporter_count: distinct,
      first_reported_at: iso(firstMs), last_reported_at: subs.length ? subs[subs.length - 1].submitted_at : iso(firstMs),
      emergency_override: emergency, fraud_flags: fraud, status: "open", composite_score: null, latest_score_id: null,
    };
    drafts.push({ issue, subs, template, region, state });
  }

  const nowDate = new Date(NOW);
  for (const region of leaves) {
    const n = FLAGSHIP[region.region_id] ?? Math.max(3, Math.min(12, Math.round(2 + 4 * Math.sqrt(region.population / 3_000_000))));
    const tilt = Object.fromEntries(Object.keys(CATEGORY_WEIGHTS).map((c) => [c, between(0.6, 1.6)])) as Record<Category, number>;
    for (let i = 0; i < n; i++) {
      const category = weighted(Object.keys(CATEGORY_WEIGHTS) as Category[], (Object.keys(CATEGORY_WEIGHTS) as Category[]).map((c) => CATEGORY_WEIGHTS[c] * tilt[c]));
      const template = pick(TEMPLATES_BY_CATEGORY.get(category)!);
      // Recent activity keeps the charts alive; the rest spreads over two years, biased to the problem's season.
      let firstMs: number;
      if (rand() < (FLAGSHIP[region.region_id] ? 0.4 : 0.25)) firstMs = NOW - between(0.5, 30) * DAY;
      else if (template.peak && rand() < 0.55) {
        const month = pick(template.peak);
        const year = nowDate.getUTCFullYear() - (month - 1 >= nowDate.getUTCMonth() ? 1 : 0) - Math.floor(rand() * 2);
        firstMs = Date.UTC(year, month - 1, 1 + Math.floor(rand() * 27), 9);
      } else firstMs = monthsBack(1 + Math.floor(rand() * 23), 1 + Math.floor(rand() * 27));
      if (firstMs > NOW - DAY) firstMs = NOW - between(1, 20) * DAY;
      makeIssue(region, template, firstMs);
    }
  }

  // Seasonal recurrence the forecaster can see: the same problem in the same month across several years.
  const FORECAST_PAIRS: [string, string, number, number][] = [
    ["dl-central-delhi", "water.handpump", 10, 3], ["dl-south-delhi", "roads.waterlogged", 10, 3], ["mh-mumbai-city", "roads.waterlogged", 10, 2],
    ["ka-bengaluru-urban", "sanitation.drain", 10, 3], ["tn-chennai", "roads.waterlogged", 10, 3], ["mh-pune", "water.no_supply", 10, 2],
    ["br-sao-paulo", "sanitation.drain", 10, 3], ["dl-central-delhi", "electricity.outages", 5, 3],
  ];
  for (const [regionId, templateId, month, years] of FORECAST_PAIRS) {
    const region = byId.get(regionId);
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (!region || !template) continue;
    for (let y = 1; y <= years; y++) {
      for (let k = 0; k < 2; k++) {
        const ms = Date.UTC(nowDate.getUTCFullYear() - y, month - 1, 4 + k * 9, 10);
        makeIssue(region, template, ms, { forceScored: true });
      }
    }
  }

  // The demo citizen reports on a handful of Delhi issues (added to counts before scoring, so scores stay consistent).
  const citizenTargets = drafts.filter((d) => d.region.region_id === "dl-central-delhi" && d.issue.first_reported_at > iso(NOW - 200 * DAY) && !d.issue.fraud_flags.length);
  const citizenPicks = citizenTargets.slice(0, 7);
  citizenPicks.forEach((d, i) => {
    subN += 1;
    const idx = i % d.template.reports.length;
    const sub: Submission = {
      ...d.subs[0], submission_id: `dm_sub_c${i + 1}`, idempotency_key: `dm_idem_c${i + 1}`, citizen_id: citizenUid, channel: i % 3 === 1 ? "voice" : "web",
      raw_text: d.template.reports[idx], pii_scrubbed_text: d.template.reports[idx], detected_language: "en", translated_text: null,
      submitted_at: iso(Date.parse(d.issue.first_reported_at) + DAY * (i % 2)), tracking_code: i === 0 ? DEMO_TRACKING_CODE : trackingCode(), location_text: `${pick(LOCALITIES)}, ${d.region.name}`,
    };
    d.subs.push(sub);
    d.issue.submission_ids.push(sub.submission_id);
    d.issue.report_count += 1;
    d.issue.distinct_reporter_count = Math.max(d.issue.distinct_reporter_count, 3) + 1;
  });

  console.log(`  ${drafts.length} issues, ${drafts.reduce((n, d) => n + d.subs.length, 0)} reports`);
  await writeAll("issues", drafts.map((d) => ({ id: d.issue.issue_id, data: d.issue })));
  await writeAll("submissions", drafts.flatMap((d) => d.subs.map((s) => ({ id: s.submission_id, data: s }))));
  const citizen: Citizen = { citizen_id: citizenUid, phone_hash: "demo", preferred_language: "en-IN", country_code: "IN", created_at: iso(NOW - 120 * DAY), erasure_requested_at: null };
  await writeAll("citizens", [{ id: citizenUid, data: citizen }]);

  // ---- Phase B: the real scoring engine ------------------------------------------------------------------
  console.log("Scoring with the worker...");
  const scoreRes = await fetch(`${WORKER_URL}/jobs/score`, { method: "POST", headers: WORKER_SECRET ? { "x-worker-secret": WORKER_SECRET } : {} }).catch((e) => {
    throw new Error(`Could not reach the worker at ${WORKER_URL} (${e.message}). Start it, then re-run.`);
  });
  if (!scoreRes.ok) throw new Error(`Worker scoring failed: ${scoreRes.status} ${await scoreRes.text()}`);
  console.log("  ", JSON.stringify(await scoreRes.json()).slice(0, 160));

  const scores = new Map<string, PriorityScore>();
  for (const d of (await db.collection("priorityScores").where("is_canonical", "==", true).get()).docs) {
    const s = d.data() as PriorityScore;
    if (s.issue_id.startsWith("dm_iss_")) scores.set(s.issue_id, s);
  }

  // ---- Phase C: workflow history --------------------------------------------------------------------------
  console.log("Layering workflow history...");
  const projects: Project[] = [];
  const impacts: ImpactRecord[] = [];
  const audit: { id: string; data: object }[] = [];
  const comments: IssueComment[] = [];
  const notifications: Notification[] = [];
  const issueUpdates = new Map<string, Partial<Issue>>();
  let auditN = 0;
  let noteN = 0;
  let ntfN = 0;
  let prjN = 0;

  const log = (actor: { uid: string }, action: string, targetId: string, before: unknown, after: unknown, why: string | null, ms: number) => {
    auditN += 1;
    audit.push({ id: `dm_aud_${auditN}`, data: { audit_id: `dm_aud_${auditN}`, actor_id: actor.uid, action, target_id: targetId, before, after, justification: why, timestamp: iso(ms) } });
  };
  const notify = (recipient: string, kind: Notification["kind"], params: Notification["params"], link: string, ms: number, read: boolean) => {
    ntfN += 1;
    notifications.push({ notification_id: `dm_ntf_${ntfN}`, recipient_id: recipient, kind, params, link, created_at: iso(ms), read_at: read ? iso(ms + 3_600_000) : null });
  };

  const STAGES = ["open", "verified", "prioritized", "funded", "in_progress", "resolved"] as const;
  const statusFor = (ageDays: number, scored: boolean): (typeof STAGES)[number] | "disputed" => {
    if (!scored) return weighted(["open", "verified", "disputed"] as const, [62, 32, 6]);
    const w = ageDays > 200 ? [8, 10, 6, 10, 10, 50, 3] : ageDays > 60 ? [15, 18, 12, 14, 14, 24, 2] : [45, 30, 10, 6, 3, 3, 3];
    return weighted(["open", "verified", "prioritized", "funded", "in_progress", "resolved", "disputed"] as const, w);
  };

  const citizenIssueIds = new Set(citizenPicks.map((d) => d.issue.issue_id));
  const citizenOrder = ["open", "verified", "prioritized", "funded", "in_progress", "in_progress", "resolved"] as const; // matches citizenPicks order
  const awaitingConfirmation = new Set<string>();

  for (const d of drafts) {
    const issue = d.issue;
    const score = scores.get(issue.issue_id);
    const scored = Boolean(score);
    const firstMs = Date.parse(issue.first_reported_at);
    const ageDays = (NOW - firstMs) / DAY;
    const actor = actorFor(d.region.region_id, d.state);

    let target: (typeof STAGES)[number] | "disputed";
    const citizenIdx = citizenPicks.findIndex((p) => p.issue.issue_id === issue.issue_id);
    if (citizenIdx >= 0) target = scored || citizenOrder[citizenIdx] === "open" ? citizenOrder[citizenIdx] : "verified";
    else if (issue.fraud_flags.length) target = "open";
    else if (issue.emergency_override) target = weighted(["open", "verified", "prioritized", "in_progress"] as const, [25, 30, 25, 20]);
    else target = statusFor(ageDays, scored);
    if (!scored && STAGES.indexOf(target as never) > 1) target = "verified";

    // Timeline: each stage takes a while; if it would run past "now", squeeze it, or stop at an earlier stage.
    const durations: Record<string, number> = { verified: between(1, 12), prioritized: between(2, 14), funded: between(5, 28), in_progress: between(4, 24), resolved: between(20, 80) };
    const path = target === "disputed" ? ["disputed"] : STAGES.slice(1, STAGES.indexOf(target) + 1);
    const total = path.reduce((n, s) => n + (durations[s] ?? between(1, 10)), 0);
    const budgetDays = Math.max(0, ageDays - 1.5);
    const squeeze = total > budgetDays && total > 0 ? budgetDays / total : 1;
    let cursor = firstMs;
    const at: Record<string, number> = {};
    for (const stage of path) {
      cursor += (durations[stage] ?? between(1, 10)) * squeeze * DAY;
      at[stage] = cursor;
    }
    if (squeeze < 0.25 && path.length > 1 && target !== "disputed") {
      // Not enough elapsed time for the chosen stage: fall back to verified.
      target = "verified";
    }

    const finalStatus = target;
    const patch: Partial<Issue> = { status: finalStatus as Issue["status"], support_count: scored ? Math.floor(rand() ** 2 * 46) : Math.floor(rand() * 4) };

    // Audit trail and workflow records for each stage reached.
    const reached = target === "open" ? [] : target === "disputed" ? ["disputed"] : STAGES.slice(1, STAGES.indexOf(target as never) + 1);
    for (const stage of reached) {
      const ms = at[stage] ?? firstMs + DAY;
      if (stage === "verified") log(actor, "issue_status_change", issue.issue_id, { status: "open" }, { status: "verified" }, pick(AUDIT_REASONS.verified), ms);
      else if (stage === "disputed") log(actor, "issue_status_change", issue.issue_id, { status: "open" }, { status: "disputed" }, pick(AUDIT_REASONS.disputed), ms);
      else if (stage === "prioritized") log(actor, "project_recommended", issue.issue_id, null, { project_id: `dm_prj_${prjN + 1}` }, null, ms);
      else if (stage === "funded") log(actor, "project_status_change", `dm_prj_${prjN + 1}`, { status: "recommended" }, { status: "funded" }, null, ms);
      else if (stage === "in_progress") log(actor, "project_status_change", `dm_prj_${prjN + 1}`, { status: "funded" }, { status: "in_progress" }, null, ms);
    }

    // Project (from "prioritized" onward), impact record when completed.
    if (STAGES.indexOf(target as never) >= 2 && score) {
      prjN += 1;
      const projectId = `dm_prj_${prjN}`;
      const budget = Math.round((BASE_BUDGET[issue.category] * (1 + Math.min(issue.report_count, 50) / 50)) / 1000) * 1000;
      const isDone = target === "resolved";
      const awaiting = citizenIdx >= 0 && citizenOrder[citizenIdx] === "in_progress" && citizenIdx === 5 && target === "in_progress";
      const completedMs = isDone ? at.resolved : null;
      const markedMs = isDone ? at.resolved - between(3, 10) * DAY : awaiting ? NOW - 2 * DAY : null;
      const region = d.region.name;
      projects.push({
        project_id: projectId, issue_id: issue.issue_id, country_code: issue.country_code, state_id: issue.state_id,
        generated_brief: `Recommended: ${d.template.subcategory} works in ${region}. ${issue.distinct_reporter_count} distinct citizens reported this issue (${issue.report_count} reports). Its priority score is ${score.composite_score.toFixed(2)}, combining demand ${score.demand_score.toFixed(2)}, vulnerability ${score.vulnerability_score.toFixed(2)} and infrastructure gap ${score.gap_score.toFixed(2)}. ${score.estimated_impact_population ? `An estimated ${score.estimated_impact_population.toLocaleString("en-IN")} people are affected.` : ""}`,
        brief_model_version: "seed-template-v1",
        brief_citations: [{ claim: `priority score ${score.composite_score.toFixed(2)}`, source: "priorityScores", field: "composite_score" }],
        groundedness_check: { passed: true, unverified_claims: [] },
        composite_score: score.composite_score,
        status: isDone ? "completed" : target === "in_progress" ? "in_progress" : target === "funded" ? "funded" : "recommended",
        assigned_dept: DEPARTMENT[issue.category] ?? DEPARTMENT.other, budget_estimate_inr: budget,
        marked_complete_at: markedMs ? iso(markedMs) : null, officer_signed_off_at: isDone ? iso(completedMs!) : null,
      });
      if (isDone || awaiting) {
        const received = isDone ? Math.min(3 + Math.floor(rand() * 3), Math.max(3, issue.distinct_reporter_count)) : 1;
        const negative = isDone && rand() < 0.2 ? 1 : 0;
        impacts.push({
          impact_id: `dm_imp_${prjN}`, project_id: projectId, issue_id: issue.issue_id, country_code: issue.country_code, state_id: issue.state_id,
          category: issue.category, region_id: d.region.region_id, confirmations_received: received, confirmations_required: 3, confirmations_negative: negative,
          resolution_photo_url: null, resolved_at: isDone ? iso(completedMs!) : "", verified_by: "dm_citizens", efficacy: Number((received / (received + negative)).toFixed(2)),
        });
      }
      if (awaiting) awaitingConfirmation.add(issue.issue_id);
    }

    // Assignment and internal notes.
    if (STAGES.indexOf(target as never) >= 1 && target !== "resolved" && rand() < 0.5) {
      patch.assigned_to_uid = actor.uid;
      patch.assigned_to_label = actor.label;
      patch.assigned_at = iso(at.verified ?? firstMs + DAY);
      if (ageDays < 45) notify(actor.uid, "issue.assigned", { category: issue.category, issue_id: issue.issue_id }, `/console/issues/${issue.issue_id}`, Date.parse(patch.assigned_at), rand() < 0.4);
    }
    if (STAGES.indexOf(target as never) >= 1 && rand() < 0.16) {
      for (let k = 0; k < 1 + Math.floor(rand() * 2); k++) {
        noteN += 1;
        const author = pick([actor, { uid: uid.national, label: label(accountByKey.get("national")!) }]);
        comments.push({ comment_id: `dm_cmt_${noteN}`, issue_id: issue.issue_id, author_id: author.uid, author_label: author.label, author_role: "district_collector", body: pick(OFFICER_NOTES), created_at: iso((at.verified ?? firstMs) + (k + 1) * DAY * between(0.5, 3)) });
      }
    }

    // The demo citizen's inbox mirrors what has happened to the issues they reported.
    if (citizenIdx >= 0) {
      const subId = `dm_sub_c${citizenIdx + 1}`;
      const link = `/my/${subId}`;
      for (const stage of reached) {
        const kind = stage === "funded" ? "issue.funded" : "issue.status_changed";
        notify(citizenUid, kind, { category: issue.category, status: stage }, link, at[stage] ?? firstMs + DAY, rand() < 0.5);
      }
      if (awaitingConfirmation.has(issue.issue_id)) notify(citizenUid, "issue.confirm_resolution", { category: issue.category }, link, NOW - 2 * DAY, false);
    }
    issueUpdates.set(issue.issue_id, patch);
  }

  // A known tracking code on an anonymous report, for the "follow without an account" demo.
  const trackTarget = drafts.find((d) => d.region.region_id === "dl-south-delhi" && ["funded", "in_progress"].includes(String(issueUpdates.get(d.issue.issue_id)?.status)));
  const submissionPatches: Submission[] = [];
  if (trackTarget) {
    const first = trackTarget.subs.find((s) => s.citizen_id.startsWith("dm_cit_"));
    if (first) submissionPatches.push({ ...first, tracking_code: "JS-M4X8R2WH", citizen_id: "anonymous", channel: "sms" });
  }

  // Budget plans for Delhi: one approved (from what is funded), one draft to try approving live.
  const plans: BudgetPlan[] = [];
  const delhiIssues = drafts.filter((d) => d.state === "IN-DL");
  const projectByIssue = new Map(projects.map((p) => [p.issue_id, p]));
  const asItem = (d: Draft) => {
    const s = scores.get(d.issue.issue_id)!;
    return { issue_id: d.issue.issue_id, cost_inr: projectByIssue.get(d.issue.issue_id)?.budget_estimate_inr ?? BASE_BUDGET[d.issue.category], value: s.composite_score, composite_score: s.composite_score, vulnerability_score: s.vulnerability_score, beneficiaries: s.estimated_impact_population ?? 0, category: d.issue.category, region_id: d.issue.admin_region_id, scheme_id: null };
  };
  const funded = delhiIssues.filter((d) => issueUpdates.get(d.issue.issue_id)?.status === "funded" && scores.has(d.issue.issue_id)).slice(0, 5);
  if (funded.length >= 2) {
    const items = funded.map(asItem);
    plans.push({
      plan_id: "dm_plan_1", name: "Monsoon readiness (approved)", region_id: "IN-DL", created_by: uid.delhi, created_at: iso(NOW - 40 * DAY), status: "approved", approved_at: iso(NOW - 36 * DAY),
      params: { budget_inr: Math.ceil(items.reduce((n, i) => n + i.cost_inr, 0) / 100_000) * 100_000, min_vulnerable_share: 0.3 }, items,
      totals: { cost_inr: items.reduce((n, i) => n + i.cost_inr, 0), beneficiaries: items.reduce((n, i) => n + i.beneficiaries, 0), vulnerable_share: 0.4, issues: items.length },
    });
  }

  // ---- write everything ---------------------------------------------------------------------------------------
  console.log("Writing workflow data...");
  await Promise.all([...issueUpdates].map(([id, patch]) => db.collection("issues").doc(id).update(patch as Record<string, unknown>)));
  await writeAll("projects", projects.map((p) => ({ id: p.project_id, data: p })));
  await writeAll("impactRecords", impacts.map((r) => ({ id: r.project_id, data: r })));
  await writeAll("auditLog", audit);
  await writeAll("issueComments", comments.map((c) => ({ id: c.comment_id, data: c })));
  await writeAll("notifications", notifications.map((n) => ({ id: n.notification_id, data: n })));
  await writeAll("budgetPlans", plans.map((p) => ({ id: p.plan_id, data: p })));
  if (submissionPatches.length) await writeAll("submissions", submissionPatches.map((s) => ({ id: s.submission_id, data: s })));

  // Summary
  const finals = [...issueUpdates.values()];
  const byStatus = finals.reduce<Record<string, number>>((m, p) => ((m[String(p.status)] = (m[String(p.status)] ?? 0) + 1), m), {});
  console.log("\nDone.", JSON.stringify({ issues: drafts.length, scored: scores.size, projects: projects.length, resolved: impacts.filter((i) => i.resolved_at).length, byStatus }));
  console.log("\nLogins (password for officers: " + PASSWORD + ")");
  for (const a of ACCOUNTS) console.log(`  ${a.email.padEnd(28)} ${a.role.padEnd(20)} ${a.region}`);
  console.log(`  citizen@jansetu.demo         citizen (password ${CITIZEN_PASSWORD})`);
  console.log(`Demo tracking codes: ${DEMO_TRACKING_CODE} (citizen report), JS-M4X8R2WH (anonymous SMS)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

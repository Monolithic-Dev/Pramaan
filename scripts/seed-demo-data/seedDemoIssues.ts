// Seeds illustrative sample issues/scores/projects/impact/audit history across the
// reference regions loaded by seedFirestoreReference.ts, so the console, map,
// forecasts and equity audit have something to show in a fresh environment.
// Every Issue is marked is_synthetic: true, which the UI badges as sample data.
//
// Run: FIREBASE_SERVICE_ACCOUNT_JSON=<json|base64> pnpm --filter @jansetu/scripts exec tsx seed-demo-data/seedDemoIssues.ts
import { randomUUID } from "node:crypto";
import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { Issue, PriorityScore, Project, ImpactRecord } from "@jansetu/shared-types";

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
initializeApp({
  credential: raw
    ? cert(JSON.parse(raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")))
    : applicationDefault(),
  projectId: process.env.GCP_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID,
});
const db = getFirestore();

const CATEGORIES = ["roads", "water", "electricity", "sanitation", "health_infra", "education_infra", "other"] as const;
const STATUSES: Issue["status"][] = ["open", "verified", "disputed", "prioritized", "funded", "in_progress", "resolved"];
const DEPTS: Record<(typeof CATEGORIES)[number], string> = {
  roads: "Public Works Department",
  water: "Water Supply Board",
  electricity: "State Electricity Board",
  sanitation: "Urban Sanitation Department",
  health_infra: "Department of Health",
  education_infra: "Department of Education",
  other: "District Administration",
};

// Leaf admin regions from scripts/seed-demo-data/source/admin_regions.csv.
const REGIONS = [
  { regionId: "dl-central-delhi", stateId: "DL", country: "IN", lat: 28.6519, lng: 77.2315 },
  { regionId: "dl-south-delhi", stateId: "DL", country: "IN", lat: 28.5245, lng: 77.2066 },
  { regionId: "mh-mumbai-city", stateId: "MH", country: "IN", lat: 18.9388, lng: 72.8354 },
  { regionId: "mh-pune", stateId: "MH", country: "IN", lat: 18.5204, lng: 73.8567 },
  { regionId: "ka-bengaluru-urban", stateId: "KA", country: "IN", lat: 12.9716, lng: 77.5946 },
  { regionId: "ka-mysuru", stateId: "KA", country: "IN", lat: 12.2958, lng: 76.6394 },
  { regionId: "br-sao-paulo", stateId: "SP", country: "BR", lat: -23.5505, lng: -46.6333 },
  { regionId: "br-campinas", stateId: "SP", country: "BR", lat: -22.9099, lng: -47.0626 },
  { regionId: "br-santos", stateId: "SP", country: "BR", lat: -23.9608, lng: -46.3339 },
] as const;

const ISSUES_PER_REGION = 9; // one per category
const now = new Date();

function daysAgo(d: number): Date {
  return new Date(now.getTime() - d * 86_400_000);
}

function jitter(lat: number, lng: number) {
  return { lat: lat + (Math.random() - 0.5) * 0.05, lng: lng + (Math.random() - 0.5) * 0.05 };
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42); // deterministic across re-runs

async function main() {
  const issues: Issue[] = [];
  const scores: PriorityScore[] = [];
  const projects: Project[] = [];
  const impacts: ImpactRecord[] = [];
  const audit: { audit_id: string; actor_id: string; action: string; before: unknown; after: unknown; justification: string | null; timestamp: string; target_id?: string }[] = [];

  let idx = 0;
  for (const region of REGIONS) {
    for (let c = 0; c < ISSUES_PER_REGION; c++, idx++) {
      const category = CATEGORIES[c % CATEGORIES.length];
      const status = STATUSES[idx % STATUSES.length];
      const band = idx % 3; // 0 low, 1 medium, 2 high vulnerability
      const vulnerability = band === 0 ? 0.15 + rand() * 0.15 : band === 1 ? 0.4 + rand() * 0.2 : 0.7 + rand() * 0.25;
      const demand = 0.3 + rand() * 0.6;
      const gap = 0.2 + rand() * 0.7;
      const composite = Number((demand * 0.4 + vulnerability * 0.3 + gap * 0.3).toFixed(3));
      const reportCount = 3 + Math.floor(rand() * 12);
      const distinctReporters = Math.max(1, reportCount - Math.floor(rand() * 3));
      const firstReported = daysAgo(20 + Math.floor(rand() * 500));
      const { lat, lng } = jitter(region.lat, region.lng);

      const issueId = `demo-${region.regionId}-${category}-${idx}`;
      const scoreId = `score-${issueId}`;

      const issue: Issue = {
        issue_id: issueId,
        country_code: region.country,
        state_id: region.stateId,
        category,
        subcategory: "general",
        canonical_description: `Sample report: ${category.replace("_", " ")} issue near ${region.regionId}.`,
        embedding: null,
        embedding_model: null,
        geo_cluster_id: `cluster-${issueId}`,
        admin_region_id: region.regionId,
        geohash: null,
        centroid_lat: lat,
        centroid_lng: lng,
        is_synthetic: true,
        submission_ids: [],
        report_count: reportCount,
        distinct_reporter_count: distinctReporters,
        first_reported_at: firstReported.toISOString(),
        last_reported_at: daysAgo(Math.max(0, 20 + Math.floor(rand() * 500) - 200)).toISOString(),
        emergency_override: false,
        fraud_flags: [],
        status,
        composite_score: composite,
        latest_score_id: scoreId,
      };
      issues.push(issue);

      scores.push({
        score_id: scoreId,
        issue_id: issueId,
        country_code: region.country,
        state_id: region.stateId,
        demand_score: Number(demand.toFixed(3)),
        vulnerability_score: Number(vulnerability.toFixed(3)),
        gap_score: Number(gap.toFixed(3)),
        duplication_penalty: 0,
        impact_efficacy: null,
        base_score: composite,
        composite_score: composite,
        weights: { demand: 0.4, vulnerability: 0.3, gap: 0.3 },
        data_fallbacks: [],
        model_version: "seed-demo-v1",
        computed_at: firstReported.toISOString(),
        is_canonical: true,
        estimated_impact_population: Math.floor(500 + rand() * 20000),
      });

      audit.push({
        audit_id: randomUUID(),
        actor_id: "seed-script",
        action: "issue_status_change",
        before: { status: "open" },
        after: { status },
        justification: "Illustrative sample data seeded for demo purposes.",
        timestamp: firstReported.toISOString(),
        target_id: issueId,
      });

      const hasProject = ["prioritized", "funded", "in_progress", "resolved"].includes(status);
      if (hasProject) {
        const projectId = `proj-${issueId}`;
        const projectStatus: Project["status"] =
          status === "prioritized" ? "recommended" : status === "funded" ? "funded" : status === "in_progress" ? "in_progress" : "completed";
        const budget = Math.floor(200_000 + rand() * 2_000_000);
        const markedComplete = projectStatus === "completed" ? daysAgo(Math.floor(rand() * 60)).toISOString() : null;
        projects.push({
          project_id: projectId,
          issue_id: issueId,
          country_code: region.country,
          state_id: region.stateId,
          generated_brief: `Recommended fix for a ${category.replace("_", " ")} issue affecting an estimated ${distinctReporters} reporters near ${region.regionId}, with a composite priority score of ${composite}.`,
          brief_model_version: "seed-demo-v1",
          brief_citations: [{ claim: `composite score ${composite}`, source: "priorityScores", field: "composite_score" }],
          groundedness_check: { passed: true, unverified_claims: [] },
          composite_score: composite,
          status: projectStatus,
          assigned_dept: DEPTS[category],
          budget_estimate_inr: budget,
          marked_complete_at: markedComplete,
          officer_signed_off_at: projectStatus === "completed" ? markedComplete : null,
        });

        audit.push({
          audit_id: randomUUID(),
          actor_id: "seed-script",
          action: "project_recommended",
          before: null,
          after: { project_id: projectId },
          justification: null,
          timestamp: firstReported.toISOString(),
          target_id: issueId,
        });

        if (projectStatus === "completed") {
          const confirmationsRequired = 3;
          const confirmationsReceived = 2 + Math.floor(rand() * 2);
          impacts.push({
            impact_id: `impact-${issueId}`,
            project_id: projectId,
            issue_id: issueId,
            country_code: region.country,
            state_id: region.stateId,
            category,
            region_id: region.regionId,
            confirmations_received: confirmationsReceived,
            confirmations_required: confirmationsRequired,
            confirmations_negative: Math.floor(rand() * 1.2),
            resolution_photo_url: null,
            resolved_at: markedComplete as string,
            verified_by: "seed-script",
            efficacy: Number((0.55 + rand() * 0.4).toFixed(2)),
          });
        }
      }
    }
  }

  // A clear seasonal forecast: 3 years of "water" issues in dl-central-delhi peaking each October.
  const forecastRegion = REGIONS[0];
  for (const year of [now.getUTCFullYear() - 3, now.getUTCFullYear() - 2, now.getUTCFullYear() - 1]) {
    const id = `demo-forecast-${forecastRegion.regionId}-water-${year}`;
    const { lat, lng } = jitter(forecastRegion.lat, forecastRegion.lng);
    issues.push({
      issue_id: id,
      country_code: forecastRegion.country,
      state_id: forecastRegion.stateId,
      category: "water",
      subcategory: "general",
      canonical_description: "Sample report: seasonal water-logging near Central Delhi.",
      embedding: null,
      embedding_model: null,
      geo_cluster_id: `cluster-${id}`,
      admin_region_id: forecastRegion.regionId,
      geohash: null,
      centroid_lat: lat,
      centroid_lng: lng,
      is_synthetic: true,
      submission_ids: [],
      report_count: 6,
      distinct_reporter_count: 5,
      first_reported_at: new Date(Date.UTC(year, 9, 12)).toISOString(), // October
      last_reported_at: new Date(Date.UTC(year, 9, 20)).toISOString(),
      emergency_override: false,
      fraud_flags: [],
      status: "resolved",
      composite_score: 0.62,
      latest_score_id: null,
    });
  }

  console.log(`Writing ${issues.length} issues, ${scores.length} scores, ${projects.length} projects, ${impacts.length} impact records, ${audit.length} audit entries...`);

  const BATCH_LIMIT = 400;
  async function commitAll(writes: { ref: FirebaseFirestore.DocumentReference; data: unknown }[]) {
    for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      for (const w of writes.slice(i, i + BATCH_LIMIT)) batch.set(w.ref, w.data as FirebaseFirestore.DocumentData);
      await batch.commit();
    }
  }

  await commitAll(issues.map((i) => ({ ref: db.collection("issues").doc(i.issue_id), data: i })));
  await commitAll(scores.map((s) => ({ ref: db.collection("priorityScores").doc(s.score_id), data: s })));
  await commitAll(projects.map((p) => ({ ref: db.collection("projects").doc(p.project_id), data: p })));
  await commitAll(impacts.map((r) => ({ ref: db.collection("impactRecords").doc(r.project_id), data: r })));
  await commitAll(audit.map((a) => ({ ref: db.collection("auditLog").doc(a.audit_id), data: a })));

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

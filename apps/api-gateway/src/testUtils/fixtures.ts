import type { Issue, PriorityScore, Submission } from "@jansetu/shared-types";
import { buildApp } from "../app.js";
import { createFakeDeps } from "./fakeDeps.js";

export type Deps = ReturnType<typeof createFakeDeps>;

let n = 0;
export function issue(over: Partial<Issue> = {}): Issue {
  n += 1;
  return {
    issue_id: `iss_f${n}`, country_code: "IN", state_id: "IN-DL", category: "roads", subcategory: "pothole",
    canonical_description: "Large pothole near the market", embedding: null, embedding_model: null, geo_cluster_id: "g",
    admin_region_id: "dl-central", geohash: "ttnfvr", centroid_lat: 28.65, centroid_lng: 77.23, submission_ids: [],
    report_count: 6, distinct_reporter_count: 4, first_reported_at: new Date().toISOString(),
    last_reported_at: new Date().toISOString(), emergency_override: false, fraud_flags: [], status: "open",
    composite_score: 0.7, latest_score_id: "sc", ...over,
  };
}

export function score(issueId: string, over: Partial<PriorityScore> = {}): PriorityScore {
  return {
    score_id: `sc_${issueId}`, issue_id: issueId, country_code: "IN", state_id: "IN-DL", demand_score: 0.8,
    vulnerability_score: 0.5, gap_score: 0.6, duplication_penalty: 0, impact_efficacy: null, base_score: 0.7,
    composite_score: 0.7, weights: { demand: 0.4, vulnerability: 0.3, gap: 0.3 }, data_fallbacks: [],
    model_version: "formula-v2", computed_at: "2026-09-01T00:00:00Z", is_canonical: true, estimated_impact_population: 1000, ...over,
  };
}

export function submission(id: string, citizenId: string, issueId: string | null, over: Partial<Submission> = {}): Submission {
  return {
    submission_id: id, idempotency_key: id, citizen_id: citizenId, country_code: "IN", channel: "web", raw_text: `text ${id}`,
    raw_audio_url: null, photo_url: null, detected_language: "en", translated_text: null, pii_scrubbed_text: `text ${id}`,
    lat: null, lng: null, location_text: null, location_confidence: "high", geohash: null, resolved_region_id: null,
    state_id: null, issue_id: issueId, submitted_at: "2026-09-01T00:00:00Z", status: "processed",
    processing_error: null, submitter_ip_hash: null, tracking_code: null, ...over,
  };
}

/** A Delhi state with two districts (and Pune in another state), officers at each level, and helpers to seed data. */
export function setup() {
  const deps = createFakeDeps();
  deps.regions.push(
    { regionId: "IN-DL", name: "Delhi", level: "state", parentRegionId: null, countryCode: "IN", population: 16_000_000, lat: 28.7, lng: 77.1 },
    { regionId: "dl-central", name: "Central Delhi", level: "district", parentRegionId: "IN-DL", countryCode: "IN", population: 582_000, lat: 28.65, lng: 77.23 },
    { regionId: "dl-south", name: "South Delhi", level: "district", parentRegionId: "IN-DL", countryCode: "IN", population: 2_700_000, lat: 28.52, lng: 77.2 },
    { regionId: "mh-pune", name: "Pune", level: "district", parentRegionId: "IN-MH", countryCode: "IN", population: 9_400_000, lat: 18.5, lng: 73.8 },
  );
  const chain = (id: string, level: string, parent?: string, parentLevel = "state") =>
    deps.ancestryByRegion.set(id, [{ regionId: id, level }, ...(parent ? [{ regionId: parent, level: parentLevel }] : [])]);
  chain("IN-DL", "state");
  chain("dl-central", "district", "IN-DL");
  chain("dl-south", "district", "IN-DL");
  chain("mh-pune", "district", "IN-MH");

  const tok = (name: string, role: string, region: string) => {
    deps.tokens.set(name, { uid: `u_${name}`, claims: { role, region_id: region, country_code: "IN" } });
    deps.officerAccounts.push({
      uid: `u_${name}`, email: `${name}@gov.test`, role: role as never, region_id: region, country_code: "IN",
      disabled: false, created_at: "2026-01-01T00:00:00Z", last_sign_in: null,
    });
    return { authorization: `Bearer ${name}` };
  };
  const citizen = (name: string) => {
    deps.tokens.set(name, { uid: `c_${name}`, claims: {} });
    return { authorization: `Bearer ${name}` };
  };

  const put = (i: Issue, s: Partial<Parameters<typeof score>[1]> | null = {}) => {
    deps.store.issues.set(i.issue_id, i);
    if (s) deps.store.priorityScores.set(`sc_${i.issue_id}`, score(i.issue_id, s));
    return i;
  };

  return {
    deps,
    app: buildApp(deps),
    put,
    admin: tok("admin", "state_admin", "IN-DL"),
    collector: tok("collector", "district_collector", "dl-central"),
    southCollector: tok("south", "district_collector", "dl-south"),
    field: tok("field", "field_officer", "dl-central"),
    pune: tok("pune", "district_collector", "mh-pune"),
    alice: citizen("alice"),
    bob: citizen("bob"),
  };
}

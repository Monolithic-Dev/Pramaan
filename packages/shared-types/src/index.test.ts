import { describe, expect, it } from "vitest";
import * as fixtures from "./fixtures.js";

// Guards against drift from docs/DATA_MODEL.md: each fixture's key set must match
// the JSON example there (plus state_id, added per DATA_MODEL.md §4).
const expectedKeys: Record<string, string[]> = {
  citizenFixture: ["citizen_id", "phone_hash", "preferred_language", "created_at"],
  submissionFixture: [
    "submission_id",
    "citizen_id",
    "channel",
    "raw_text",
    "raw_audio_url",
    "photo_url",
    "detected_language",
    "translated_text",
    "lat",
    "lng",
    "location_confidence",
    "submitted_at",
    "status",
    "state_id",
  ],
  issueFixture: [
    "issue_id",
    "category",
    "subcategory",
    "canonical_description",
    "geo_cluster_id",
    "submission_ids",
    "report_count",
    "first_reported_at",
    "last_reported_at",
    "status",
    "state_id",
  ],
  geoClusterFixture: [
    "cluster_id",
    "centroid_lat",
    "centroid_lng",
    "admin_boundary",
    "issue_ids",
    "state_id",
  ],
  infraIndexFixture: ["region_id", "index_type", "value", "source", "year", "state_id"],
  investmentRecordFixture: [
    "investment_id",
    "region_id",
    "scheme_name",
    "amount_inr",
    "category",
    "fiscal_year",
    "state_id",
  ],
  priorityScoreFixture: [
    "score_id",
    "issue_id",
    "demand_score",
    "vulnerability_score",
    "gap_score",
    "duplication_penalty",
    "composite_score",
    "model_version",
    "computed_at",
    "state_id",
  ],
  projectFixture: [
    "project_id",
    "issue_id",
    "generated_brief",
    "composite_score",
    "status",
    "assigned_dept",
    "budget_estimate_inr",
    "state_id",
  ],
  impactRecordFixture: [
    "impact_id",
    "project_id",
    "citizen_confirmations",
    "resolution_photo_url",
    "resolved_at",
    "verified_by",
    "state_id",
  ],
  officerUserFixture: [
    "officer_id",
    "name",
    "role",
    "jurisdiction",
    "auth_provider_id",
    "state_id",
  ],
  agentSessionFixture: [
    "session_id",
    "officer_id",
    "query_text",
    "tool_calls",
    "agent_response",
    "timestamp",
    "state_id",
  ],
};

describe("shared-types fixtures match DATA_MODEL.md field sets", () => {
  for (const [name, keys] of Object.entries(expectedKeys)) {
    it(`${name} has exactly the expected fields`, () => {
      const fixture = (fixtures as Record<string, object>)[name];
      expect(Object.keys(fixture).sort()).toEqual([...keys].sort());
    });
  }
});

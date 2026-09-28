import { describe, expect, it } from "vitest";
import { computeAlignment, inferSettlement, matchSchemes } from "./schemes.js";
import { issue } from "../testUtils/fixtures.js";
import { slaFor } from "./sla.js";
import { gradeFor } from "./analytics.js";
import { newTrackingCode, normalizeTrackingCode, trackingCodeCandidates } from "../lib/trackingCode.js";
import { inr } from "./briefing.js";
import { csvCell } from "../routes/reports.js";

describe("inferSettlement", () => {
  it("says what it inferred from, and is honest when it cannot tell", () => {
    expect(inferSettlement({ name: "Bengaluru Urban", level: "district", population: 9_000_000 }).settlement).toBe("urban");
    expect(inferSettlement({ name: "Santos", level: "município", population: 400_000 }).settlement).toBe("urban");
    expect(inferSettlement({ name: "Pune", level: "district", population: 9_400_000 }).basis).toContain("population");
    expect(inferSettlement({ name: "Somewhere", level: "district", population: 300_000 }).settlement).toBe("unknown");
    expect(inferSettlement(undefined).settlement).toBe("unknown");
  });
});

describe("matchSchemes", () => {
  it("ranks rural road schemes first for a rural road issue and computes the centre/state split", () => {
    const m = matchSchemes(issue({ category: "roads", subcategory: "village road", canonical_description: "broken bridge connectivity" }), "rural", 1_000_000);
    expect(m[0].scheme.id).toBe("pmgsy");
    expect(m[0].funding).toEqual({ budget_inr: 1_000_000, centre_inr: 600_000, state_inr: 400_000 });
    expect(m[0].reasons.join(" ")).toContain("Report mentions");
    // The fallback routes exist but never outrank a specific scheme.
    expect(m.at(-1)!.scheme.id === "mplads" || m.at(-1)!.scheme.id === "state_plan" || m.at(-1)!.scheme.id === "xvfc").toBe(true);
  });

  it("prefers the urban water scheme for an urban water issue and the rural one for a rural issue", () => {
    const water = issue({ category: "water", subcategory: "pipeline", canonical_description: "supply pipeline leak" });
    expect(matchSchemes(water, "urban")[0].scheme.id).toBe("amrut2");
    expect(matchSchemes(water, "rural")[0].scheme.id).toBe("jjm");
  });

  it("only offers schemes that fund the issue's category", () => {
    const ids = matchSchemes(issue({ category: "education_infra" }), "unknown").map((m) => m.scheme.id);
    expect(ids).toContain("samagra");
    expect(ids).not.toContain("pmgsy");
    expect(ids).not.toContain("jjm");
  });
});

describe("computeAlignment", () => {
  it("totals what could be drawn from central funds and skips resolved issues", () => {
    const regions = new Map();
    const a = computeAlignment([issue({ category: "roads", report_count: 0 }), issue({ category: "health_infra", report_count: 0 }), issue({ status: "resolved" })], regions);
    expect(a.open_issues).toBe(2);
    expect(a.total_cost_inr).toBe(500_000 + 900_000);
    expect(a.centre_inr).toBeGreaterThan(0);
    expect(a.centre_inr + a.state_inr).toBe(a.total_cost_inr);
    expect(a.by_scheme.length).toBeGreaterThan(0);
  });
});

describe("slaFor", () => {
  const now = new Date("2026-09-20T00:00:00Z");
  const at = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString();

  it("gives higher priority a shorter window and flags overdue and due-soon", () => {
    expect(slaFor({ status: "open", composite_score: 0.8, emergency_override: false, first_reported_at: at(3), sla_due_at: null }, now)).toMatchObject({ state: "ok", days_left: 4 });
    expect(slaFor({ status: "open", composite_score: 0.8, emergency_override: false, first_reported_at: at(6), sla_due_at: null }, now).state).toBe("due_soon");
    expect(slaFor({ status: "open", composite_score: 0.8, emergency_override: false, first_reported_at: at(10), sla_due_at: null }, now)).toMatchObject({ state: "overdue", days_left: -3 });
    // The same age is fine for a low-priority issue (45 days).
    expect(slaFor({ status: "open", composite_score: 0.2, emergency_override: false, first_reported_at: at(10), sla_due_at: null }, now).state).toBe("ok");
  });

  it("shortens for emergencies, stops once someone acts, and honours a manual due date", () => {
    expect(slaFor({ status: "open", composite_score: 0.2, emergency_override: true, first_reported_at: at(3), sla_due_at: null }, now).state).toBe("overdue");
    expect(slaFor({ status: "verified", composite_score: 0.8, emergency_override: false, first_reported_at: at(100), sla_due_at: null }, now)).toMatchObject({ state: "met", days_left: null });
    expect(slaFor({ status: "open", composite_score: 0.8, emergency_override: false, first_reported_at: at(100), sla_due_at: new Date(now.getTime() + 5 * 86_400_000).toISOString() }, now).state).toBe("ok");
  });
});

describe("gradeFor", () => {
  it("rewards resolution, responsiveness and speed, and only gives an A for strong performance on all three", () => {
    expect(gradeFor(0.9, 0, 10).grade).toBe("A");
    expect(gradeFor(0.5, 0.2, 60).grade).toBe("C");
    expect(gradeFor(0, 1, null).grade).toBe("E");
    expect(gradeFor(0.9, 0.9, 100).points).toBeLessThan(gradeFor(0.9, 0, 10).points);
  });
});

describe("tracking codes", () => {
  it("generates unambiguous codes and normalises what people actually type", () => {
    const code = newTrackingCode();
    expect(code).toMatch(/^PR-[2-9A-HJKMNP-Z]{8}$/);
    expect(normalizeTrackingCode(code.toLowerCase())).toBe(code);
    expect(normalizeTrackingCode(code.replace("-", " "))).toBe(code);
    expect(normalizeTrackingCode(code.slice(3))).toBe(code);
    expect(normalizeTrackingCode("PR-0000000O")).toBeNull(); // ambiguous characters are not in the alphabet
    expect(normalizeTrackingCode("short")).toBeNull();
  });

  it("handles a body that itself begins with a prefix", () => {
    expect(normalizeTrackingCode("JSAB2345")).toBe("PR-JSAB2345");
    expect(normalizeTrackingCode("PR-JSAB2345")).toBe("PR-JSAB2345");
    expect(normalizeTrackingCode("PRAB2345")).toBe("PR-PRAB2345");
  });

  it("keeps codes issued before the rename (JS-) working", () => {
    expect(normalizeTrackingCode("js-k7m3 p9qd")).toBe("JS-K7M3P9QD");
    expect(trackingCodeCandidates("PR-K7M3P9QD")).toEqual(["PR-K7M3P9QD", "JS-K7M3P9QD"]);
    expect(trackingCodeCandidates("JS-K7M3P9QD")).toEqual(["JS-K7M3P9QD", "PR-K7M3P9QD"]);
  });
});

describe("formatting helpers", () => {
  it("formats rupees the Indian way", () => {
    expect(inr(4_500_000)).toBe("₹45 lakh");
    expect(inr(12_000_000)).toBe("₹1.2 crore");
    expect(inr(85_000)).toBe("₹85,000");
  });

  it("neutralises spreadsheet formulas and quotes awkward cells in CSV", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(12)).toBe("12");
  });
});

// Lists every translation key the web app uses that en.json does not define (and, with --unused, keys
// nothing uses). Run from the repo root: node scripts/i18n-check.mjs [--unused]
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const WEB = "apps/web/src";
const en = JSON.parse(readFileSync(join(WEB, "i18n/en.json"), "utf8"));

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [p] : [];
  });
}

const source = files(WEB).map((f) => readFileSync(f, "utf8")).join("\n");
const PREFIXES = "landing|login|report|status|my|console|issue|project|team|states|audit|equity|forecast|copilot|footer|nav|citizen|guard|notFound|auth|badge|common|perm|role|level|transparency|score|officer|insights|map|flag|journey|brand|category|consent|profile|planner|schemes|queue|impact|briefing|notify|palette|sla|assign|notes|issueSchemes|track|community|od|ch|about|app";

const used = new Set([...source.matchAll(/\bt\(\s*["'`]([A-Za-z0-9_.]+)["'`]/g)].map((m) => m[1]));
for (const m of source.matchAll(new RegExp(`["'\`]((?:${PREFIXES})\\.[A-Za-z0-9_.]+)["'\`]`, "g"))) used.add(m[1]);

// Dynamic families: t(`family.${x}`) needs every member the code can produce.
const FAMILIES = {
  category: ["roads", "water", "electricity", "sanitation", "health_infra", "education_infra", "other"],
  status: ["open", "verified", "disputed", "prioritized", "funded", "in_progress", "resolved"],
  "status.priority": ["high", "medium", "low", "pending"],
  level: ["low", "medium", "high", "country", "state", "estado", "district", "município"],
  role: ["field_officer", "district_collector", "state_admin", "national_admin", "citizen"],
  journey: ["received", "understood", "verified", "funded", "fixed"],
  project: ["recommended", "funded", "in_progress", "completed"],
  flag: ["burst_detected", "geofence_mismatch", "photo_implausible"],
  audit: ["issue_status_change", "emergency_override", "project_recommended", "project_status_change", "mark_complete", "officer_signoff", "officer_created", "officer_disabled", "officer_enabled", "state_created", "issue_assigned", "issue_unassigned", "plan_saved", "plan_approved"],
  notify: ["issue.status_changed", "issue.funded", "issue.confirm_resolution", "issue.assigned", "issue.emergency", "issue.comment", "plan.approved"],
  "schemes.settlement": ["urban", "rural", "both"],
  "planner.status": ["draft", "approved"],
  "queue.tab": ["mine", "overdue", "emergency", "unassigned"],
  "ch": ["web", "voice", "whatsapp", "sms"].flatMap((c) => ["tag", "title", "body"].map((k) => `${c}.${k}`)),
  "about.p": ["explain", "ground", "equity", "privacy", "lang", "loop"].flatMap((p) => ["title", "body"].map((k) => `${p}.${k}`)),
  "landing.f": ["languages", "voice", "vision", "dedup", "schemes", "planner", "forecast", "equity", "copilot", "scorecards", "privacy", "opendata"].flatMap((f) => ["title", "body"].map((k) => `${f}.${k}`)),
  "landing": [1, 2, 3, 4, 5].flatMap((n) => ["title", "body"].map((k) => `step${n}.${k}`)),
};
for (const [family, members] of Object.entries(FAMILIES)) for (const m of members) used.add(`${family}.${m}`);
// Keys handed to t() through arrays/props ("queue.empty.<tab>.title"):
for (const tab of FAMILIES["queue.tab"]) for (const k of ["title", "body"]) used.add(`queue.empty.${tab}.${k}`);

// A literal that is only the prefix of other used keys (e.g. "landing.f.planner" before ".title") is not itself a key,
// and neither are the notification kind names that key the bell's icon map.
const isPrefix = (k) => [...used].some((u) => u !== k && u.startsWith(k + "."));
const ICON_KINDS = new Set(FAMILIES.notify);
const missing = [...used].filter((k) => !(k in en) && !k.endsWith(".") && !isPrefix(k) && !ICON_KINDS.has(k)).sort();
console.log(`used ${used.size}, defined ${Object.keys(en).length}, MISSING ${missing.length}`);
for (const k of missing) console.log(k);
if (process.argv.includes("--unused")) {
  const unused = Object.keys(en).filter((k) => !used.has(k)).sort();
  console.log(`\nUNUSED ${unused.length}`);
  for (const k of unused) console.log(k);
}

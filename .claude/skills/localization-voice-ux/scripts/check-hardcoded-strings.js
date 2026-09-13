#!/usr/bin/env node
/**
 * scripts/check-hardcoded-strings.js
 *
 * Scans apps/web/src for likely hardcoded UI string literals outside the
 * i18n files. Not a perfect parser — a fast heuristic check to run before
 * merging any frontend PR. False positives are expected for non-UI strings
 * (log messages, internal keys); review the output rather than trusting it blindly.
 *
 * Usage: node check-hardcoded-strings.js [path-to-apps/web/src]
 */
const fs = require("fs");
const path = require("path");

const targetDir = process.argv[2] || "apps/web/src";
const IGNORE_DIRS = new Set(["i18n", "node_modules", "__tests__"]);
// JSX text content or string literals that look like sentences (contain a space and a letter),
// aren't obviously a class name, path, or identifier.
const SUSPICIOUS_PATTERN = />\s*[A-Z][a-zA-Z ,.'!?]{4,}\s*</g;

let findings = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (/\.(tsx|jsx)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, "utf8");
      const matches = content.match(SUSPICIOUS_PATTERN);
      if (matches) {
        findings.push({ file: fullPath, matches: [...new Set(matches)] });
      }
    }
  }
}

if (!fs.existsSync(targetDir)) {
  console.error(`Directory not found: ${targetDir}`);
  process.exit(1);
}

walk(targetDir);

if (findings.length === 0) {
  console.log("No likely hardcoded strings found. (Heuristic check — review manually if unsure.)");
  process.exit(0);
}

console.log(`Found ${findings.length} file(s) with possible hardcoded UI strings:\n`);
for (const { file, matches } of findings) {
  console.log(`  ${file}`);
  for (const m of matches) console.log(`    ${m.trim()}`);
}
console.log("\nMove these into apps/web/src/i18n/*.json before merging, or confirm they're not user-facing.");
process.exit(1);

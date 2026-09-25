// Merges a JSON file of new/changed English strings into apps/web/src/i18n/en.json and removes the
// stale translations of any key whose English text changed, so translate-i18n.ts re-translates it.
// Run from the repo root: node scripts/i18n-merge.mjs path/to/additions.json
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "apps/web/src/i18n";
const additions = JSON.parse(readFileSync(process.argv[2], "utf8"));
const read = (lang) => JSON.parse(readFileSync(join(DIR, `${lang}.json`), "utf8"));
const write = (lang, obj) =>
  writeFileSync(join(DIR, `${lang}.json`), JSON.stringify(Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b))), null, 2) + "\n");

const en = read("en");
const changed = [];
let added = 0;
for (const [key, value] of Object.entries(additions)) {
  if (!(key in en)) added += 1;
  else if (en[key] !== value) changed.push(key);
  en[key] = value;
}
write("en", en);

const LANGS = ["hi", "ta", "pt", "bn", "te", "mr", "kn", "ml", "gu", "pa"];
for (const lang of LANGS) {
  if (!existsSync(join(DIR, `${lang}.json`))) continue;
  const dict = read(lang);
  for (const key of changed) delete dict[key];
  write(lang, dict);
}
console.log(`added ${added}, changed ${changed.length} (translations for those were cleared)`);

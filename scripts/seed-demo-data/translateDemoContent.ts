// Translates the citizen-report templates in demoContent.ts into every language the demo dataset uses and
// writes demoContent.i18n.json. Run once (and again only when templates change); the JSON is committed so
// seeding never needs the network.
//
// Run: GEMINI_API_KEY=... ./node_modules/.bin/tsx seed-demo-data/translateDemoContent.ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LANGUAGE_NAMES, TEMPLATES } from "./demoContent.js";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "demoContent.i18n.json");
const MODELS = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.5-flash"];
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("GEMINI_API_KEY is required");

// template id -> language -> report phrasings
type Bank = Record<string, Record<string, string[]>>;
const bank: Bank = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};

async function ask(language: string, source: Record<string, string[]>): Promise<Record<string, string[]>> {
  const prompt = `Translate each English sentence below into ${language}. These are short complaints written by ordinary residents to their local government about a public infrastructure problem: keep the tone plain, first-person and natural, as a person would really write or say it, not formal or literal.
Return ONLY a JSON object with exactly the same keys, each mapped to an array of translated strings in the same order. No markdown.

${JSON.stringify(source)}`;
  let last: unknown;
  for (const model of MODELS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.3 } }),
      });
      if (!res.ok) throw new Error(`${model} ${res.status}`);
      const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error(`${model}: empty`);
      const parsed = JSON.parse(text) as Record<string, string[]>;
      for (const key of Object.keys(source)) {
        if (!Array.isArray(parsed[key]) || parsed[key].length !== source[key].length) throw new Error(`${model}: bad shape for ${key}`);
      }
      return parsed;
    } catch (err) {
      last = err;
      console.warn(`  ${(err as Error).message}`);
    }
  }
  throw last;
}

const source = Object.fromEntries(TEMPLATES.map((t) => [t.id, t.reports]));
for (const [code, name] of Object.entries(LANGUAGE_NAMES)) {
  if (code === "en") continue;
  const missing = Object.fromEntries(Object.entries(source).filter(([id]) => !bank[id]?.[code]));
  if (Object.keys(missing).length === 0) {
    console.log(`${code}: complete`);
    continue;
  }
  console.log(`${code}: translating ${Object.keys(missing).length} templates`);
  const ids = Object.keys(missing);
  for (let i = 0; i < ids.length; i += 15) {
    const chunk = Object.fromEntries(ids.slice(i, i + 15).map((id) => [id, missing[id]]));
    let attempt = 0;
    for (;;) {
      try {
        const out = await ask(name, chunk);
        for (const id of Object.keys(chunk)) (bank[id] ??= {})[code] = out[id];
        break;
      } catch (err) {
        if (++attempt >= 3) throw err;
        await new Promise((r) => setTimeout(r, 3000 * attempt));
      }
    }
  }
  writeFileSync(OUT, JSON.stringify(bank, null, 1) + "\n");
}
console.log("wrote", OUT);

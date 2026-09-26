// Fills missing keys in apps/web/src/i18n/{hi,ta,pt}.json from en.json using Gemini.
// Run: GEMINI_API_KEY=... pnpm --filter @pramaan/scripts exec tsx translate-i18n.ts
import { readFileSync, writeFileSync } from "node:fs";

const LANGS: Record<string, string> = {
  hi: "Hindi", ta: "Tamil", pt: "Brazilian Portuguese", bn: "Bengali", te: "Telugu",
  mr: "Marathi", kn: "Kannada", ml: "Malayalam", gu: "Gujarati", pa: "Punjabi (Gurmukhi script)",
};
const placeholders = (text: string) => (text.match(/{[A-Za-z0-9_]+}/g) ?? []).sort().join("|");
const DIR = "../apps/web/src/i18n";
const MODELS = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.5-flash"];
const BATCH = 60;

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is required");
  process.exit(1);
}

function load(lang: string): Record<string, string> {
  return JSON.parse(readFileSync(`${DIR}/${lang}.json`, "utf8"));
}

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function translateBatch(langName: string, entries: [string, string][]): Promise<Record<string, string>> {
  const source = Object.fromEntries(entries);
  const prompt = `Translate the JSON object values below into ${langName}, for a government citizen-services web app UI.
Keep the JSON keys exactly the same. Keep any "{placeholder}" tokens (curly braces and the name inside) unchanged, verbatim, in the translated text.
Keep it natural, concise UI copy — not literal word-for-word translation. Do not translate the placeholder names themselves.
"Pramaan" is the product's name: keep it a proper noun, written phonetically in the target script (e.g. Hindi "प्रमाण"), never replaced by a synonym or translated for its meaning.
Reply with ONLY the translated JSON object, no markdown fences, no commentary.

${JSON.stringify(source, null, 2)}`;

  let lastErr: unknown;
  for (const model of MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
          }),
        },
      );
      if (!res.ok) throw new Error(`Gemini ${res.status} (${model}): ${await res.text()}`);
      const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error(`No text in Gemini response: ${JSON.stringify(body)}`);
      return JSON.parse(text);
    } catch (err) {
      lastErr = err;
      console.warn(`  ${model} failed: ${(err as Error).message.slice(0, 120)}`);
    }
  }
  throw lastErr;
}

async function main() {
  const en = load("en");
  for (const [lang, langName] of Object.entries(LANGS)) {
    const existing = load(lang);
    const missingKeys = Object.keys(en).filter((k) => !(k in existing));
    if (missingKeys.length === 0) {
      console.log(`${lang}: nothing missing`);
      continue;
    }
    console.log(`${lang}: translating ${missingKeys.length} keys...`);
    const entries: [string, string][] = missingKeys.map((k) => [k, en[k]]);
    for (const batch of chunks(entries, BATCH)) {
      let translated: Record<string, string> | undefined;
      for (let attempt = 1; attempt <= 3 && !translated; attempt++) {
        try {
          translated = await translateBatch(langName, batch);
        } catch (err) {
          console.error(`  batch attempt ${attempt} failed:`, (err as Error).message.slice(0, 200));
          if (attempt < 3) await new Promise((r) => setTimeout(r, 3000 * attempt));
        }
      }
      if (!translated) throw new Error("batch failed after 3 attempts");
      for (const [k] of batch) {
        // A translation is only accepted if it keeps exactly the {placeholders} the English has.
        if (typeof translated[k] === "string" && translated[k].length > 0 && placeholders(translated[k]) === placeholders(en[k])) {
          existing[k] = translated[k];
        } else {
          console.warn(`  bad or missing translation for ${k}, falling back to English`);
          existing[k] = en[k];
        }
      }
      await new Promise((r) => setTimeout(r, 600));
    }
    const sorted = Object.fromEntries(Object.entries(existing).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(`${DIR}/${lang}.json`, JSON.stringify(sorted, null, 2) + "\n");
    console.log(`${lang}: wrote ${Object.keys(sorted).length} keys`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

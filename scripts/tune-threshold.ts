// docs/phases/phase-4-extraction-dedup.md §4.5: sweep the similarity threshold
// against a labelled set of submission pairs, record precision/recall/F1 at
// each point. Run: pnpm --filter @jansetu/scripts tune-threshold
//
// Input format (scripts/dedup-tuning/pairs.json): an array of
// { scoreA: number[], scoreB: number[], isDuplicate: boolean } — two
// embeddings and a human label. The shipped pairs.json is a small illustrative
// fixture, NOT the real 120-pair hand-labelled set the phase doc calls for —
// see docs/DEDUP-TUNING.md for why, and what real tuning needs.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cosine } from "@jansetu/shared-utils";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface LabelledPair {
  embeddingA: number[];
  embeddingB: number[];
  isDuplicate: boolean;
}

interface ThresholdResult {
  threshold: number;
  precision: number;
  recall: number;
  f1: number;
}

export function sweepThresholds(
  pairs: LabelledPair[],
  { from = 0.7, to = 0.92, step = 0.02 } = {},
): ThresholdResult[] {
  const results: ThresholdResult[] = [];
  for (let threshold = from; threshold <= to + 1e-9; threshold += step) {
    let truePositive = 0;
    let falsePositive = 0;
    let falseNegative = 0;

    for (const pair of pairs) {
      const predictedDuplicate = cosine(pair.embeddingA, pair.embeddingB) >= threshold;
      if (predictedDuplicate && pair.isDuplicate) truePositive += 1;
      else if (predictedDuplicate && !pair.isDuplicate) falsePositive += 1;
      else if (!predictedDuplicate && pair.isDuplicate) falseNegative += 1;
    }

    const precision = truePositive + falsePositive === 0 ? 1 : truePositive / (truePositive + falsePositive);
    const recall = truePositive + falseNegative === 0 ? 1 : truePositive / (truePositive + falseNegative);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

    results.push({ threshold: Number(threshold.toFixed(2)), precision, recall, f1 });
  }
  return results;
}

function formatMarkdownTable(results: ThresholdResult[]): string {
  const header = "| threshold | precision | recall | F1 |\n|---|---|---|---|";
  const rows = results.map(
    (r) => `| ${r.threshold} | ${r.precision.toFixed(2)} | ${r.recall.toFixed(2)} | ${r.f1.toFixed(2)} |`,
  );
  return [header, ...rows].join("\n");
}

function main() {
  const pairsPath = join(__dirname, "dedup-tuning", "pairs.json");
  const pairs: LabelledPair[] = JSON.parse(readFileSync(pairsPath, "utf8"));
  const results = sweepThresholds(pairs);
  const best = [...results].sort((a, b) => b.f1 - a.f1)[0];

  const output = `# Dedup similarity threshold tuning

**⚠ Placeholder run** — swept against ${pairs.length} illustrative pairs in
\`scripts/dedup-tuning/pairs.json\`, not the real 120 hand-labelled pairs (60
true duplicates, 60 near-misses) the phase plan calls for. Re-run this script
against real labelled submission data before treating the selected threshold
as production-final — see docs/phases/phase-4-manual-checklist.md.

${formatMarkdownTable(results)}

Best F1 in this run: **${best.threshold}** (precision ${best.precision.toFixed(2)}, recall ${best.recall.toFixed(2)}).
Current default in \`apps/worker-ai-pipeline/src/lib/env.ts\` (\`DEDUP_SIMILARITY_THRESHOLD\`): 0.82.
`;

  writeFileSync(join(__dirname, "..", "docs", "DEDUP-TUNING.md"), output);
  console.log(output);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}

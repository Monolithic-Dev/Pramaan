// docs/AI_PIPELINE.md Stage 5 refusal guardrail, layer 2: numeric verification.
// Deterministic, not another LLM call — every numeral the model states must
// appear in that turn's serialised tool results, or the claim is unverifiable.
export function extractNumerals(text: string): string[] {
  return text.match(/-?\d+(?:\.\d+)?%?/g) ?? [];
}

export interface GroundednessResult {
  passed: boolean;
  unverifiedClaims: string[];
}

export function verifyGrounded(text: string, toolResults: unknown[]): GroundednessResult {
  const serialized = JSON.stringify(toolResults);
  const unverified = extractNumerals(text).filter((numeral) => {
    const bare = numeral.replace("%", "");
    return !serialized.includes(numeral) && !serialized.includes(bare);
  });
  return { passed: unverified.length === 0, unverifiedClaims: [...new Set(unverified)] };
}

// Split on '.', '!', '?' followed by whitespace + a capital letter/opening paren,
// but not when the punctuation immediately follows a digit — avoids breaking
// decimals like "0.63" into two sentences. Heuristic, not full NLP; sufficient
// for the short, templated/agent-generated prose this guards.
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[^\d\s])[.!?]+\s+(?=[A-Z(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Refusal guardrail layer 3 (docs/AI_PIPELINE.md Stage 5 / phase-6-agent-rag.md
 * §6.3): "Unmappable sentences containing numbers are stripped."
 *
 * Honest scope: this is still substring matching, the same primitive layer 2
 * uses — it cannot detect that a genuine tool number was attached to the wrong
 * claim (e.g. an investment amount narrated as a report count), because that
 * number legitimately exists in the tool output and no regex can tell which
 * English noun phrase it was supposed to describe. What this layer actually
 * adds over layer 2: granularity. Layer 2 either accepts the whole response or
 * throws the whole thing away for one bad numeral, forcing a full regeneration.
 * This drops only the offending sentence, so a multi-sentence answer with one
 * unfindable number salvages its other, genuinely-grounded sentences instead of
 * being discarded wholesale.
 */
export function stripUngroundedSentences(text: string, toolResults: unknown[]): string {
  const sentences = splitSentences(text);
  const serializedResults = toolResults.map((r) => JSON.stringify(r));
  const kept = sentences.filter((sentence) => {
    const numerals = extractNumerals(sentence);
    if (numerals.length === 0) return true;
    return numerals.every((numeral) => {
      const bare = numeral.replace("%", "");
      return serializedResults.some((r) => r.includes(numeral) || r.includes(bare));
    });
  });
  return kept.join(" ");
}

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

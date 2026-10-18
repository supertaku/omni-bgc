const approvedOnly =
  /\b(?:only\s+(?:approved|verified)(?:\s+(?:records?|results?|data|facts?|menus?|sources?|options?|items?|entries|listings?|places?|restaurants?|dishes?)){0,2}|(?:approved|verified)(?:\s+(?:records?|results?|data|facts?|menus?|sources?|options?|items?|entries|listings?|places?|restaurants?|dishes?)){0,2}\s+(?:only|lang))\b/i;
const excludeResearch =
  /\b(?:do not|don't|without|exclude|excluding|omit|no|not)\b.{0,60}\b(?:research|candidate|estimated|estimates)\b/i;

/** Both model-assisted and literal fallback lanes honor the same explicit source preference. */
export function excludesFoodResearch(query: string): boolean {
  if (typeof query !== 'string' || query.length > 2048) return true;
  const text = query.normalize('NFKC');
  return approvedOnly.test(text) || excludeResearch.test(text);
}

/** Source preferences are constraints, not item/branch search words. */
export function stripFoodSourcePreference(query: string): string {
  let text = query;
  for (const pattern of [approvedOnly, excludeResearch]) {
    const match = pattern.exec(text);
    if (!match) continue;
    const before = text.slice(0, match.index).replace(/\b(?:using|use|from|with)\s*$/i, ' ');
    text = `${before} ${text.slice(match.index + match[0].length)}`;
  }
  return text.trim();
}

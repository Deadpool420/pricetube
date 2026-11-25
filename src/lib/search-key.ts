// Client-safe search key normalization and alias generation.

const NOISE_WORDS = new Set([
  "bangladesh", "bd", "price", "prices", "in", "buy", "online", "bdt", "taka", "tk",
  "review", "specs", "specification", "latest", "new",
]);

const PRODUCT_NOISE_WORDS = new Set([
  ...NOISE_WORDS,
  "official", "unofficial", "black", "white", "blue", "green", "red", "purple", "pink",
  "gold", "silver", "grey", "gray", "titanium", "violet", "yellow", "orange", "cream",
  "mint", "lavender", "graphite",
]);

const MEMORY_PAIR = /\b\d{1,2}\s*(?:gb\s*)?(?:\/|\+)\s*(?:\d{2,4}|1)\s*(?:gb|tb)\b/gi;
const MEMORY_RAM = /\b\d{1,2}\s*gb\s*ram\b/gi;
const MEMORY_SIZE = /\b(?:32|64|128|256|512|1024|1)\s*(?:gb|tb)\b/gi;

export function normalizeSearchKey(query: string): string {
  return query
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w && !NOISE_WORDS.has(w))
    .join(" ")
    .trim();
}

/** Removes retail copy, colour, and memory capacity while preserving model identifiers and 4G/5G. */
export function normalizeProductKey(query: string): string {
  return query
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s/+]/gu, " ")
    .replace(MEMORY_PAIR, " ")
    .replace(MEMORY_RAM, " ")
    .replace(MEMORY_SIZE, " ")
    .replace(/[/+]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w && !PRODUCT_NOISE_WORDS.has(w))
    .join(" ")
    .trim();
}

/**
 * Safe manually supplied aliases. Model numbers, brands, model variants,
 * and network generations are never guessed or removed.
 */
export function buildAliases(key: string, extra: string[] = []): string[] {
  const base = normalizeProductKey(key);
  if (!base) return [];
  const out = new Set<string>();
  const add = (v: string) => {
    const n = normalizeProductKey(v);
    // Never collapse to a single bare word (too broad to be the same model).
    if (n && n !== base && n.split(" ").length >= 2) out.add(n);
  };
  for (const e of extra) {
    add(e);
  }
  return Array.from(out);
}

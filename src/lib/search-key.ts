// Client-safe search key normalization and alias generation.

const NOISE_WORDS = new Set([
  "bangladesh", "bd", "price", "prices", "in", "buy", "online", "bdt", "taka", "tk",
  "review", "specs", "specification", "latest", "new",
]);

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

const STRIPPABLE_BRANDS = ["samsung", "xiaomi", "apple"];

/**
 * Safe variants of a key: only whole filler words are removed or added
 * (brand, "galaxy", trailing "5g"). Model numbers and variant letters stay.
 */
export function buildAliases(key: string, extra: string[] = []): string[] {
  const base = normalizeSearchKey(key);
  if (!base) return [];
  const out = new Set<string>();
  const add = (v: string) => {
    const n = v.replace(/\s+/g, " ").trim();
    // Never collapse to a single bare word (too broad to be the same model).
    if (n && n !== base && n.split(" ").length >= 2) out.add(n);
  };
  const strip = (s: string, word: string) =>
    s.split(" ").filter((w) => w !== word).join(" ");

  const seeds = [base];
  for (const b of STRIPPABLE_BRANDS) if (base.split(" ").includes(b)) seeds.push(strip(base, b));
  for (const s of [...seeds]) if (s.split(" ").includes("galaxy")) seeds.push(strip(s, "galaxy"));
  for (const s of [...seeds]) {
    add(s);
    if (/\s5g$/.test(s)) add(s.replace(/\s5g$/, ""));
    else add(`${s} 5g`);
  }
  for (const e of extra) {
    const n = normalizeSearchKey(e);
    if (n && n !== base) out.add(n);
  }
  return Array.from(out);
}

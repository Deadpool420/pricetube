// Client-safe offer quality rules shared by live search, admin and refresh.

const LISTING_SEGMENTS = [
  "/category/",
  "/categories/",
  "/tag/",
  "/tags/",
  "/brand/",
  "/brands/",
  "/blog/",
  "/search",
  "/collections/",
  "/shop?",
];

const BARE_PATH_WORDS = new Set([
  "smartphone", "smartphones", "mobile", "mobiles", "mobile-phone", "mobile-phones",
  "phone", "phones", "samsung", "nothing", "xiaomi", "apple", "iphone", "realme",
  "oppo", "vivo", "oneplus", "redmi", "poco", "infinix", "tecno", "motorola",
  "honor", "huawei", "google", "cmf", "laptop", "laptops", "tablet", "tablets",
  "shop", "products", "all-products", "brands", "deals", "offers",
]);

/** True when the URL looks like a listing/search/category page, not one product. */
export function isListingUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return true;
  }
  const full = (u.pathname + (u.search ? `?${u.search.slice(1)}` : "")).toLowerCase();
  if (LISTING_SEGMENTS.some((s) => full.includes(s))) return true;
  const params = u.searchParams;
  if (params.has("q") || params.has("search")) return true;
  const path = u.pathname.toLowerCase().replace(/\/+$/, "");
  if (path === "") return true;
  const last = path.split("/").pop() ?? "";
  if (BARE_PATH_WORDS.has(last)) return true;
  return false;
}

export function isPlaceholderTitle(title: string | null | undefined): boolean {
  const t = (title ?? "").trim();
  if (!t) return true;
  if (/>=\s*null\s*=</i.test(t)) return true;
  if (/^untitled/i.test(t)) return true;
  if (/example retailer/i.test(t)) return true;
  return false;
}

const MODEL_FILLER = new Set([
  "bangladesh", "bd", "price", "prices", "buy", "official", "online", "phone",
  "smartphone", "mobile", "galaxy", "5g", "in", "bdt", "taka", "tk",
]);

const BRANDS = new Set([
  "samsung", "apple", "iphone", "xiaomi", "redmi", "poco", "realme", "oppo", "vivo",
  "iqoo", "oneplus", "nokia", "motorola", "huawei", "honor", "nothing", "cmf",
  "tecno", "infinix", "symphony", "walton", "google", "pixel", "sony", "asus",
]);

const VARIANT_WORDS = [
  "plus", "fe", "lite", "mini", "max", "edge", "flip", "fold", "ultra", "pro", "neo", "se",
];

const ACCESSORY_WORDS = [
  "case", "cover", "cable", "charger", "adapter", "protector", "tempered", "glass",
  "strap", "skin", "holder", "stand",
];

function words(s: string): string[] {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).filter(Boolean);
}

function squash(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

export function modelTokens(query: string): string[] {
  return words(query).filter((w) => !MODEL_FILLER.has(w) && !BRANDS.has(w));
}

/** Every remaining query token must appear in title or URL. */
export function matchesModel(query: string, title: string, url: string): boolean {
  const tokens = modelTokens(query);
  if (tokens.length === 0) return true;
  let path = url;
  try {
    path = decodeURIComponent(new URL(url).pathname);
  } catch {
    /* keep raw */
  }
  const haystackWords = new Set([...words(title), ...words(path)]);
  const haystackSquashed = squash(`${title} ${path}`);
  return tokens.every((t) => {
    if (haystackWords.has(t)) return true;
    // Short tokens like "3a" must match a whole word to avoid "13a" hits.
    if (t.length <= 3) return false;
    return haystackSquashed.includes(t);
  });
}

export function variantMismatch(query: string, title: string): boolean {
  const q = new Set(words(query));
  const t = new Set(words(title));
  return VARIANT_WORDS.some((v) => t.has(v) && !q.has(v));
}

export function isAccessory(query: string, title: string, price: number | null): boolean {
  const q = new Set(words(query));
  const t = new Set(words(title));
  if (ACCESSORY_WORDS.some((w) => t.has(w) && !q.has(w))) return true;
  if (typeof price === "number" && price > 0 && price < 3000) return true;
  return false;
}

export type FilterableOffer = {
  url: string;
  title: string;
  price: number | null;
  inStock?: boolean;
  suspiciousPrice?: boolean;
};

/** Returns a reason string when the offer should be dropped, else null. */
export function junkReason(
  query: string,
  category: string,
  o: FilterableOffer,
): string | null {
  if (isListingUrl(o.url)) return "listing";
  if (isPlaceholderTitle(o.title)) return "placeholder";
  if (!matchesModel(query, o.title, o.url)) return "model";
  if (variantMismatch(query, o.title)) return "variant";
  if (category === "SMARTPHONES" && isAccessory(query, o.title, o.price)) return "accessory";
  return null;
}

/** Flags prices far from the median of priced offers. */
export function markSuspicious<T extends FilterableOffer>(offers: T[]): T[] {
  const prices = offers
    .map((o) => o.price)
    .filter((p): p is number => typeof p === "number" && p > 0)
    .sort((a, b) => a - b);
  if (prices.length < 3) return offers.map((o) => ({ ...o, suspiciousPrice: false }));
  const mid = Math.floor(prices.length / 2);
  const median = prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
  return offers.map((o) => ({
    ...o,
    suspiciousPrice:
      typeof o.price === "number" && o.price > 0 && (o.price < median * 0.5 || o.price > median * 2),
  }));
}

/** Price usable as "lowest": priced, in stock, not suspicious. */
export function isLowestEligible(o: {
  price?: number | null;
  current_price?: number | null;
  inStock?: boolean;
  in_stock?: boolean;
  suspiciousPrice?: boolean;
}): boolean {
  const p = o.price ?? o.current_price;
  if (typeof p !== "number" || p <= 0) return false;
  if (o.inStock === false || o.in_stock === false) return false;
  if (o.suspiciousPrice) return false;
  return true;
}

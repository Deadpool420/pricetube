// Plain-HTML product page parser (no paid APIs). JSON-LD → Open Graph/meta → fallbacks.
import { isListingUrl } from "./offer-filters";
import { storeNameFromUrl } from "./store-names";

export type ParsedLink = {
  url: string;
  ok: boolean;
  error?: string;
  title: string;
  price: number | null;
  imageUrl: string;
  inStock: boolean;
  store: string;
  variants: string[];
  official: "Official" | "Unofficial" | null;
  looksListing: boolean;
  expectedPrice: boolean;
};

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function meta(html: string, key: string): string {
  const re1 = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${key}["'][^>]*content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name|itemprop)=["']${key}["']`, "i");
  return decode(html.match(re1)?.[1] ?? html.match(re2)?.[1] ?? "");
}

function toNum(v: unknown): number | null {
  if (typeof v === "number") return v > 0 ? v : null;
  if (typeof v !== "string") return null;
  const n = Number(v.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function findProducts(node: unknown, out: Record<string, unknown>[]) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) return node.forEach((n) => findProducts(n, out));
  const o = node as Record<string, unknown>;
  const t = o["@type"];
  const types = Array.isArray(t) ? t : [t];
  if (types.some((x) => typeof x === "string" && /product/i.test(x))) out.push(o);
  for (const k of ["@graph", "mainEntity", "itemListElement"]) if (o[k]) findProducts(o[k], out);
}

const VARIANT_RE = [
  /\b\d{1,2}\s?gb\s?(?:\/|\+)\s?\d{2,4}\s?(?:gb|tb)\b/gi,
  /\b\d{1,2}\s?gb\s?ram\b/gi,
  /\b\d{2,4}\s?(?:gb|tb)\b/gi,
  /\b[45]g\b/gi,
  /\b(black|white|blue|green|red|purple|pink|gold|silver|grey|gray|titanium|violet|yellow|orange|cream|mint|lavender|graphite)\b/gi,
];

export function parseProductHtml(url: string, html: string): ParsedLink {
  let title = "";
  let price: number | null = null;
  let imageUrl = "";
  let inStock: boolean | null = null;

  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const prods: Record<string, unknown>[] = [];
      findProducts(JSON.parse(m[1].trim()), prods);
      for (const p of prods) {
        if (!title && typeof p.name === "string") title = decode(p.name);
        const img = Array.isArray(p.image) ? p.image[0] : p.image;
        if (!imageUrl) imageUrl = typeof img === "string" ? img : ((img as { url?: string })?.url ?? "");
        const offers = Array.isArray(p.offers) ? p.offers : p.offers ? [p.offers] : [];
        for (const of of offers as Record<string, unknown>[]) {
          const pr = toNum(of.price) ?? toNum(of.lowPrice) ?? toNum((of.priceSpecification as Record<string, unknown>)?.price);
          if (price == null && pr) price = pr;
          if (inStock == null && typeof of.availability === "string")
            inStock = !/outofstock|soldout|discontinued|preorder|presale/i.test(of.availability);
        }
      }
    } catch {
      /* bad JSON-LD */
    }
  }

  if (!title) title = meta(html, "og:title") || decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  if (price == null) price = toNum(meta(html, "product:price:amount")) ?? toNum(meta(html, "og:price:amount")) ?? toNum(meta(html, "price"));
  if (!imageUrl) imageUrl = meta(html, "og:image") || meta(html, "twitter:image");
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  if (price == null) {
    const m = text.match(/(?:৳|tk\.?|bdt)\s?([\d,]{4,9})/i);
    if (m) price = toNum(m[1]);
  }
  if (inStock == null) {
    const avail = meta(html, "product:availability") || meta(html, "og:availability");
    inStock = avail ? !/out|sold|unavail|preorder/i.test(avail) : !/\b(out of stock|sold out|stock out|coming soon|upcoming)\b/i.test(text.slice(0, 20000));
  }
  try {
    if (imageUrl) imageUrl = new URL(imageUrl, url).toString();
  } catch {
    imageUrl = "";
  }

  const scope = `${title} ${text.slice(0, 20000)}`;
  const official = /\bunofficial\b/i.test(scope) ? "Unofficial" : /\bofficial\b/i.test(scope) ? "Official" : null;
  const variants = Array.from(new Set(VARIANT_RE.flatMap((re) => title.match(re) ?? []).map((v) => v.trim())));
  const expectedPrice = /\b(expected|upcoming|rumou?red)\s+price\b|price\s*\(expected\)/i.test(text.slice(0, 30000));
  const looksListing = isListingUrl(url) || /<title[^>]*>[^<]*(search results|category)/i.test(html);
  const siteName = meta(html, "og:site_name");

  return {
    url,
    ok: true,
    title: title.slice(0, 300),
    price: price ? Math.round(price) : null,
    imageUrl,
    inStock,
    store: storeNameFromUrl(url) || siteName,
    variants,
    official,
    looksListing,
    expectedPrice,
  };
}

/** Blocks localhost, private, link-local and non-http(s) URLs. */
export function isSafePublicUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return false;
  if (!h.includes(".") && !h.includes(":")) return false;
  const v4 = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
  }
  if (h.includes(":")) {
    if (h === "::1" || h === "::" || /^f[cd]/.test(h) || /^fe80/.test(h) || h.startsWith("::ffff:")) return false;
  }
  return true;
}

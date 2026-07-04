import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TRUSTED_BD_RETAILERS = [
  "mobiledokan.co",
  "dazzle.com.bd",
  "smsgadget.com",
  "applegadgetsbd.com",
  "startech.com.bd",
  "ryans.com",
  "pickaboo.com",
  "techlandbd.com",
  "bdstall.com",
  "daraz.com.bd",
  "shajgoj.com",
  "gadget-bd.com",
  "ultratech.com.bd",
];

const EXCLUDED_HOSTS = [
  "facebook.com",
  "tiktok.com",
  "scribd.com",
  "youtube.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "reddit.com",
  "quora.com",
  "wikipedia.org",
  "linkedin.com",
];

type Offer = {
  url: string;
  title: string;
  price: number | null;
  currency: string;
  imageUrl: string | null;
  siteName: string;
  description: string | null;
  suspiciousPrice?: boolean;
};

const scrapeJsonFormat = {
  type: "json" as const,
  prompt:
    "Extract the product information from this product page. Return the product title, the current price as a number (without currency symbols), the ISO currency code (e.g. USD, EUR, GBP, BDT), the main product image URL, and the merchant/site name (e.g. Amazon, MobileDokan, Daraz). If this is not a product purchase page, return null for price.",
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      price: { type: ["number", "null"] },
      currency: { type: "string" },
      imageUrl: { type: "string" },
      siteName: { type: "string" },
    },
  },
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function isExcluded(url: string): boolean {
  const h = hostOf(url);
  return EXCLUDED_HOSTS.some((bad) => h === bad || h.endsWith(`.${bad}`));
}

async function runFirecrawlSearch(
  apiKey: string,
  query: string,
  limit: number,
): Promise<Offer[]> {
  const res = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      limit,
      scrapeOptions: { onlyMainContent: true, formats: [scrapeJsonFormat] },
    }),
  });
  if (!res.ok) {
    console.error(`Firecrawl search ${res.status}`, await res.text().catch(() => ""));
    return [];
  }
  const payload = (await res.json()) as {
    data?: {
      web?: Array<{
        url?: string;
        title?: string;
        description?: string;
        json?: {
          title?: string;
          price?: number | null;
          currency?: string;
          imageUrl?: string;
          siteName?: string;
        };
        metadata?: { title?: string; ogImage?: string };
      }>;
    };
  };
  const raw = payload.data?.web ?? [];
  return raw
    .map((r): Offer | null => {
      const url = r.url ?? "";
      if (!/^https?:\/\//i.test(url)) return null;
      if (isExcluded(url)) return null;
      const j = r.json ?? {};
      let siteName = j.siteName;
      if (!siteName) {
        const host = hostOf(url);
        siteName = host ? host.split(".")[0].replace(/^\w/, (c) => c.toUpperCase()) : "Unknown";
      }
      return {
        url,
        title: j.title ?? r.title ?? r.metadata?.title ?? "Untitled",
        price: typeof j.price === "number" ? j.price : null,
        currency: (j.currency ?? "USD").toUpperCase().slice(0, 3),
        imageUrl: j.imageUrl ?? r.metadata?.ogImage ?? null,
        siteName,
        description: r.description ?? null,
      };
    })
    .filter((x): x is Offer => x !== null);
}

export const searchProductOffers = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ query: z.string().min(2).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) return { ok: false as const, error: "Search is not configured." };

    try {
      const primary = await runFirecrawlSearch(apiKey, `${data.query} buy price`, 8);

      // Determine missing trusted BD retailers (up to 4 extra targeted searches).
      const presentHosts = new Set(primary.map((o) => hostOf(o.url)));
      const missing = TRUSTED_BD_RETAILERS.filter(
        (d) => !Array.from(presentHosts).some((h) => h === d || h.endsWith(`.${d}`)),
      ).slice(0, 4);

      const targeted = (
        await Promise.all(
          missing.map((d) => runFirecrawlSearch(apiKey, `${data.query} site:${d}`, 2)),
        )
      ).flat();

      // Merge, dedupe by URL.
      const byUrl = new Map<string, Offer>();
      for (const o of [...primary, ...targeted]) {
        if (!byUrl.has(o.url)) byUrl.set(o.url, o);
      }
      let offers = Array.from(byUrl.values());

      // Flag suspicious prices (>3x median) using a filtered valid-price set.
      const validPrices = offers
        .map((o) => o.price)
        .filter((p): p is number => typeof p === "number" && p > 0)
        .sort((a, b) => a - b);
      if (validPrices.length >= 3) {
        const mid = Math.floor(validPrices.length / 2);
        const median =
          validPrices.length % 2
            ? validPrices[mid]
            : (validPrices[mid - 1] + validPrices[mid]) / 2;
        offers = offers.map((o) =>
          typeof o.price === "number" && o.price > median * 3
            ? { ...o, suspiciousPrice: true }
            : o,
        );
      }

      // Sort: trusted BD retailers first (by price asc), then others.
      const isTrusted = (o: Offer) => {
        const h = hostOf(o.url);
        return TRUSTED_BD_RETAILERS.some((d) => h === d || h.endsWith(`.${d}`));
      };
      const priceKey = (o: Offer) =>
        typeof o.price === "number" && o.price > 0 ? o.price : Number.POSITIVE_INFINITY;
      const trusted = offers.filter(isTrusted).sort((a, b) => priceKey(a) - priceKey(b));
      const rest = offers.filter((o) => !isTrusted(o));

      return { ok: true as const, offers: [...trusted, ...rest] };
    } catch (err) {
      console.error("searchProductOffers error:", err);
      return { ok: false as const, error: "Search request failed." };
    }
  });

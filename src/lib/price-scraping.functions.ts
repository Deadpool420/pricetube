import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Scrape a product page and extract structured price information using Firecrawl.
 * Returns title, price (number), currency, and image URL.
 */
export const scrapeProductFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        url: z
          .string()
          .url()
          .refine((u) => /^https?:\/\//i.test(u), {
            message: "Only http/https URLs are allowed",
          }),
        confirmed: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Firecrawl is admin-only and must be explicitly confirmed (uses credits).
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (isAdmin !== true || data.confirmed !== true) {
      return { ok: false as const, error: "Live fetching is turned off. Add prices from the catalog admin." };
    }
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      return {
        ok: false as const,
        error: "Price scraping is not configured.",
      };
    }

    try {
      const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: data.url,
          onlyMainContent: true,
          formats: [
            {
              type: "json",
              prompt:
                "Extract the product information from this product page. Return the product title, the current price as a number (without currency symbols), the ISO currency code (e.g. USD, EUR, GBP), the main product image URL, and the merchant/site name (e.g. Amazon, eBay, Walmart, Best Buy).",
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  price: { type: "number" },
                  currency: { type: "string" },
                  imageUrl: { type: "string" },
                  siteName: { type: "string" },
                },
                required: ["title", "price"],
              },
            },
          ],
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(`Firecrawl ${res.status}:`, text);
        return {
          ok: false as const,
          error: `Failed to scrape (${res.status})`,
        };
      }

      const payload = (await res.json()) as {
        success?: boolean;
        data?: {
          json?: {
            title?: string;
            price?: number;
            currency?: string;
            imageUrl?: string;
            siteName?: string;
          };
          metadata?: { title?: string; ogImage?: string; sourceURL?: string };
        };
      };

      const json = payload.data?.json ?? {};
      const meta = payload.data?.metadata ?? {};

      const title = json.title ?? meta.title ?? "Untitled product";
      const price = typeof json.price === "number" ? json.price : null;
      const currency = (json.currency ?? "USD").toUpperCase().slice(0, 3);
      const imageUrl = json.imageUrl ?? meta.ogImage ?? null;

      let siteName = json.siteName;
      if (!siteName) {
        try {
          const host = new URL(data.url).hostname.replace(/^www\./, "");
          siteName = host
            .split(".")[0]
            .replace(/^\w/, (c) => c.toUpperCase());
        } catch {
          siteName = "Unknown";
        }
      }

      return {
        ok: true as const,
        title,
        price,
        currency,
        imageUrl,
        siteName,
      };
    } catch (err) {
      console.error("scrapeProductFromUrl error:", err);
      return {
        ok: false as const,
        error: "Scraper request failed.",
      };
    }
  });

/** Optional product discovery for admins; this makes one confirmed Firecrawl search request. */
export const searchRetailerLinksWithFirecrawl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ query: z.string().trim().min(2).max(120), confirmed: z.literal(true) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (isAdmin !== true) return { ok: false as const, message: "Admins only" };

    const apiKey = process.env['FIRECRAWL_API_KEY'];
    if (!apiKey) return { ok: false as const, message: "Firecrawl is not configured" };

    const response = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `${data.query} price Bangladesh Star Tech Ryans MobileDokan Pickaboo Dazzle Gadget and Gear`,
        limit: 10,
        country: "BD",
        lang: "en",
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      console.error(`Firecrawl search failed [${response.status}]`);
      return { ok: false as const, message: `Firecrawl search failed (${response.status})` };
    }

    const payload = (await response.json()) as {
      success?: boolean;
      data?: { web?: Array<{ url?: string }> };
    };
    const { isSafePublicUrl, parseProductHtml } = await import("./link-parser");
    const { isListingUrl } = await import("./offer-filters");
    const { storeHost } = await import("./store-names");
    const trustedDomains = [
      "startech.com.bd", "gadgetandgear.com", "mobiledokan.com", "mobiledokan.co", "dazzle.com.bd",
      "pickaboo.com", "ryans.com", "smsgadget.com", "applegadgetsbd.com", "sumashtech.com",
      "daraz.com.bd", "techlandbd.com", "bdstall.com", "tahamtech.com.bd", "techdokan.com.bd",
      "shajgoj.com", "chardike.com", "arogga.com",
    ];
    const urls = Array.from(new Set((payload.data?.web ?? []).flatMap((item) => {
      const url = item.url;
      if (!url || !isSafePublicUrl(url) || isListingUrl(url)) return [];
      const host = storeHost(url);
      return trustedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`)) ? [url] : [];
    }))).slice(0, 6);
    const userAgent = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36";
    const results = await Promise.all(urls.map(async (url) => {
      try {
        const page = await fetch(url, {
          headers: { "User-Agent": userAgent, Accept: "text/html,application/xhtml+xml" },
          redirect: "manual",
          signal: AbortSignal.timeout(10000),
        });
        if (page.status >= 300 && page.status < 400) return { url, ok: false as const, error: "Page redirects elsewhere" };
        if (!page.ok) return { url, ok: false as const, error: `Store returned ${page.status}` };
        return parseProductHtml(url, (await page.text()).slice(0, 2_000_000));
      } catch {
        return { url, ok: false as const, error: "Could not open retailer page" };
      }
    }));
    if (payload.success !== true) return { ok: false as const, message: "Firecrawl found no search results" };
    return { ok: true as const, results };
  });

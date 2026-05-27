import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Scrape a product page and extract structured price information using Firecrawl.
 * Returns title, price (number), currency, and image URL.
 */
export const scrapeProductFromUrl = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        url: z.string().url(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
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

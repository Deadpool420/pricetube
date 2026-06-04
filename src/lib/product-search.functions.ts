import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Search for a product across major retailers using Firecrawl search.
 * Public — no auth required. Returns up to 8 candidate offers.
 */
export const searchProductOffers = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        query: z.string().min(2).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "Search is not configured." };
    }

    try {
      const res = await fetch("https://api.firecrawl.dev/v2/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `${data.query} buy price`,
          limit: 8,
          scrapeOptions: {
            onlyMainContent: true,
            formats: [
              {
                type: "json",
                prompt:
                  "Extract the product information from this product page. Return the product title, the current price as a number (without currency symbols), the ISO currency code (e.g. USD, EUR, GBP), the main product image URL, and the merchant/site name (e.g. Amazon, eBay, Walmart, Best Buy). If this is not a product purchase page, return null for price.",
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
              },
            ],
          },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(`Firecrawl search ${res.status}:`, text);
        return { ok: false as const, error: `Search failed (${res.status})` };
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
      const offers = raw
        .map((r) => {
          const url = r.url ?? "";
          if (!/^https?:\/\//i.test(url)) return null;
          const j = r.json ?? {};
          let siteName = j.siteName;
          if (!siteName) {
            try {
              const host = new URL(url).hostname.replace(/^www\./, "");
              siteName = host.split(".")[0].replace(/^\w/, (c) => c.toUpperCase());
            } catch {
              siteName = "Unknown";
            }
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
        .filter((x): x is NonNullable<typeof x> => x !== null);

      return { ok: true as const, offers };
    } catch (err) {
      console.error("searchProductOffers error:", err);
      return { ok: false as const, error: "Search request failed." };
    }
  });

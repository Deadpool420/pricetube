import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { markSuspicious } from "./offer-filters";

// Search answers ONLY from the verified catalog (product_catalog + catalog_sources).
// No Firecrawl calls happen here — live scraping is an admin-only, opt-in tool.

export const searchProductOffers = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        query: z.string().min(2).max(200),
        forceRefresh: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const cache = await import("./catalog-cache.server");
    const searchKey = cache.normalizeSearchKey(data.query);
    const hit = (await cache.lookupCatalog(searchKey)) ?? (await cache.fuzzyLookupCatalog(searchKey));
    if (hit && hit.offers.length > 0) {
      void cache.recordCatalogHit(hit.catalogId, await cache.getSearchCount(hit.catalogId));
      return {
        ok: true as const,
        offers: markSuspicious(hit.offers),
        fromCache: true as const,
        verified: true as const,
        notInCatalog: false,
        cachedAt: hit.lastRefreshedAt,
      };
    }
    return {
      ok: true as const,
      offers: [],
      fromCache: false as const,
      verified: false as const,
      notInCatalog: true,
      cachedAt: null as string | null,
    };
  });

/** Records a "please add this product" request as an empty pending entry for admin review. */
export const requestCatalogProduct = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ query: z.string().trim().min(2).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const cache = await import("./catalog-cache.server");
    const key = cache.normalizeSearchKey(data.query);
    if (!key) return { ok: false as const };
    const ok = await cache.recordProductRequest(key, data.query.trim());
    return { ok };
  });

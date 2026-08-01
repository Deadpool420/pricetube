// Server-only helpers for the shared product price cache.
// Reads go through the admin client too (cheap, server-side only) so the
// catalog stays server-owned: users can read it, but only the server writes.

export type CachedOffer = {
  url: string;
  title: string;
  price: number | null;
  currency: string;
  imageUrl: string | null;
  siteName: string;
  description: string | null;
};

export type CacheHit = {
  catalogId: string;
  displayName: string;
  imageUrl: string | null;
  lastRefreshedAt: string;
  offers: CachedOffer[];
};

/** Days a cached entry is considered fresh enough to serve without scraping. */
export const CACHE_FRESH_DAYS = 7;

export function normalizeSearchKey(query: string): string {
  return query
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isFresh(lastRefreshedAt: string): boolean {
  const age = Date.now() - new Date(lastRefreshedAt).getTime();
  return age < CACHE_FRESH_DAYS * 24 * 60 * 60 * 1000;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function lookupCatalog(searchKey: string): Promise<CacheHit | null> {
  try {
    const db = await admin();
    const { data, error } = await db
      .from("product_catalog")
      .select("id, display_name, image_url, last_refreshed_at, is_active")
      .eq("search_key", searchKey)
      .maybeSingle();
    if (error || !data || !data.is_active) return null;

    const { data: sources } = await db
      .from("catalog_sources")
      .select("url, title, description, price, currency, image_url, site_name")
      .eq("catalog_id", data.id);

    const offers: CachedOffer[] = (sources ?? []).map((s) => ({
      url: s.url,
      title: s.title ?? "Untitled",
      price: s.price === null ? null : Number(s.price),
      currency: s.currency ?? "BDT",
      imageUrl: s.image_url ?? null,
      siteName: s.site_name,
      description: s.description ?? null,
    }));

    return {
      catalogId: data.id,
      displayName: data.display_name,
      imageUrl: data.image_url ?? null,
      lastRefreshedAt: data.last_refreshed_at,
      offers,
    };
  } catch (err) {
    console.error("lookupCatalog failed", err);
    return null;
  }
}

/** Bump hit counters for a cache hit. Best-effort; never blocks the response. */
export async function recordCatalogHit(catalogId: string, currentCount: number) {
  try {
    const db = await admin();
    await db
      .from("product_catalog")
      .update({ search_count: currentCount + 1, last_searched_at: new Date().toISOString() })
      .eq("id", catalogId);
  } catch (err) {
    console.error("recordCatalogHit failed", err);
  }
}

export async function getSearchCount(catalogId: string): Promise<number> {
  try {
    const db = await admin();
    const { data } = await db
      .from("product_catalog")
      .select("search_count")
      .eq("id", catalogId)
      .maybeSingle();
    return data?.search_count ?? 0;
  } catch {
    return 0;
  }
}

/** Write-through: store (or refresh) a search result set in the catalog. */
export async function saveToCatalog(args: {
  searchKey: string;
  displayName: string;
  category: string;
  offers: CachedOffer[];
}): Promise<string | null> {
  if (args.offers.length === 0) return null;
  try {
    const db = await admin();
    const now = new Date().toISOString();
    const withImage = args.offers.find((o) => o.imageUrl);

    const { data: existing } = await db
      .from("product_catalog")
      .select("id, search_count")
      .eq("search_key", args.searchKey)
      .maybeSingle();

    let catalogId: string;
    if (existing) {
      catalogId = existing.id;
      await db
        .from("product_catalog")
        .update({
          display_name: args.displayName,
          category: args.category,
          image_url: withImage?.imageUrl ?? null,
          is_active: true,
          search_count: (existing.search_count ?? 0) + 1,
          last_refreshed_at: now,
          last_searched_at: now,
        })
        .eq("id", catalogId);
      await db.from("catalog_sources").delete().eq("catalog_id", catalogId);
    } else {
      const { data: inserted, error } = await db
        .from("product_catalog")
        .insert({
          search_key: args.searchKey,
          display_name: args.displayName,
          category: args.category,
          image_url: withImage?.imageUrl ?? null,
          last_refreshed_at: now,
          last_searched_at: now,
        })
        .select("id")
        .single();
      if (error || !inserted) {
        console.error("saveToCatalog insert failed", error);
        return null;
      }
      catalogId = inserted.id;
    }

    const seen = new Set<string>();
    const rows = args.offers
      .filter((o) => {
        if (seen.has(o.url)) return false;
        seen.add(o.url);
        return /^https?:\/\//i.test(o.url);
      })
      .map((o) => ({
        catalog_id: catalogId,
        site_name: o.siteName,
        url: o.url,
        title: o.title,
        description: o.description,
        price: o.price,
        currency: o.currency || "BDT",
        image_url: o.imageUrl,
        last_checked_at: now,
      }));

    if (rows.length > 0) {
      const { error: srcError } = await db.from("catalog_sources").insert(rows);
      if (srcError) console.error("saveToCatalog sources failed", srcError);
    }

    return catalogId;
  } catch (err) {
    console.error("saveToCatalog failed", err);
    return null;
  }
}

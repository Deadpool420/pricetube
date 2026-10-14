import { storeNameFromUrl } from "./store-names";
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
  inStock: boolean;
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

import { normalizeSearchKey, buildAliases } from "./search-key";
export { normalizeSearchKey, buildAliases };

export function isFresh(lastRefreshedAt: string): boolean {
  const age = Date.now() - new Date(lastRefreshedAt).getTime();
  return age < CACHE_FRESH_DAYS * 24 * 60 * 60 * 1000;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Only admin-verified catalog entries are ever served as instant results. */
export async function lookupCatalog(searchKey: string): Promise<CacheHit | null> {
  try {
    const db = await admin();
    if (!searchKey) return null;
    const { data: rows, error } = await db
      .from("product_catalog")
      .select("id, search_key, display_name, image_url, last_refreshed_at, is_active, verification_status")
      .or(`search_key.eq."${searchKey.replace(/"/g, "")}",aliases.cs.{"${searchKey.replace(/"/g, "")}"}`)
      .eq("is_active", true)
      .eq("verification_status", "verified")
      .limit(5);
    if (error || !rows || rows.length === 0) return null;
    const data = rows.find((r) => r.search_key === searchKey) ?? rows[0];

    const { data: sources } = await db
      .from("catalog_sources")
      .select("url, title, description, price, currency, image_url, site_name, in_stock, verified")
      .eq("catalog_id", data.id)
      .or("verified.is.null,verified.eq.true");

    const offers: CachedOffer[] = (sources ?? []).map((s) => ({
      url: s.url,
      title: s.title ?? "Untitled",
      price: s.price === null ? null : Number(s.price),
      currency: s.currency ?? "BDT",
      imageUrl: s.image_url ?? null,
      siteName: s.site_name || storeNameFromUrl(s.url),
      description: s.description ?? null,
      inStock: s.in_stock !== false,
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

/**
 * Queue live search results for admin review. Never touches verified or
 * rejected entries, so unverified scrapes can't overwrite curated data.
 */
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
      .select("id, search_count, verification_status")
      .eq("search_key", args.searchKey)
      .maybeSingle();

    let catalogId: string;
    if (existing) {
      if (existing.verification_status !== "pending_review") {
        await db
          .from("product_catalog")
          .update({ search_count: (existing.search_count ?? 0) + 1, last_searched_at: now })
          .eq("id", existing.id);
        return existing.id;
      }
      catalogId = existing.id;
      await db
        .from("product_catalog")
        .update({
          display_name: args.displayName,
          category: args.category,
          image_url: withImage?.imageUrl ?? null,
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
          aliases: buildAliases(args.searchKey),
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
        site_name: storeNameFromUrl(o.url),
        url: o.url,
        title: o.title,
        description: o.description,
        price: o.price,
        currency: o.currency || "BDT",
        image_url: o.imageUrl,
        in_stock: o.inStock !== false,
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

/** Fallback: verified entry whose key contains every query word (e.g. "s26 ultra"). */
export async function fuzzyLookupCatalog(searchKey: string): Promise<CacheHit | null> {
  try {
    const words = searchKey.split(" ").filter((w) => w.length >= 2).slice(0, 6);
    if (words.length === 0) return null;
    const db = await admin();
    let q = db
      .from("product_catalog")
      .select("search_key")
      .eq("is_active", true)
      .eq("verification_status", "verified");
    for (const w of words) q = q.ilike("search_key", `%${w.replace(/[%_,()]/g, "")}%`);
    const { data } = await q.order("search_count", { ascending: false }).limit(1);
    if (!data || data.length === 0) return null;
    return lookupCatalog(data[0].search_key);
  } catch {
    return null;
  }
}

/** Store a user request as an empty pending_review entry (no-op if the key exists). */
export async function recordProductRequest(searchKey: string, displayName: string): Promise<boolean> {
  try {
    const db = await admin();
    const { data: existing } = await db
      .from("product_catalog")
      .select("id, search_count")
      .eq("search_key", searchKey)
      .maybeSingle();
    if (existing) {
      await db
        .from("product_catalog")
        .update({ search_count: (existing.search_count ?? 0) + 1, last_searched_at: new Date().toISOString() })
        .eq("id", existing.id);
      return true;
    }
    const { error } = await db.from("product_catalog").insert({
      search_key: searchKey,
      aliases: buildAliases(searchKey),
      display_name: displayName.slice(0, 200),
      category: "SMARTPHONES",
      verification_status: "pending_review",
    });
    return !error;
  } catch {
    return false;
  }
}

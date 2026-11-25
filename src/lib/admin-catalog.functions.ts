import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildAliases, normalizeProductKey } from "./search-key";

/** Canonical base-model key; memory, colour, and retail wording are excluded. */
export function generateSearchKey(name: string): string {
  return normalizeProductKey(name);
}

type Ctx = { supabase: any; userId: string };

async function assertAdmin(context: Ctx) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

const urlSchema = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => /^https?:\/\//i.test(v), { message: "URL must start with http:// or https://" });

const optionalText = z.string().trim().max(2000).optional().nullable();

export const checkIsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: data === true };
  });

export const listCatalogEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        search: z.string().trim().max(200).optional(),
        status: z.enum(["verified", "pending_review", "rejected"]).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    let q = context.supabase
      .from("product_catalog")
      .select("id, search_key, display_name, category, image_url, is_active, search_count, last_refreshed_at, verification_status")
      .order("last_searched_at", { ascending: false })
      .limit(200);
    if (data.search) q = q.ilike("display_name", `%${data.search}%`);
    if (data.status) q = q.eq("verification_status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r: { id: string }) => r.id);
    const counts: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: srcs } = await context.supabase
        .from("catalog_sources")
        .select("catalog_id")
        .in("catalog_id", ids);
      for (const s of srcs ?? []) counts[s.catalog_id] = (counts[s.catalog_id] ?? 0) + 1;
    }
    return {
      entries: (rows ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        sourceCount: counts[r.id as string] ?? 0,
      })),
    };
  });

export const listCatalogSources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ catalogId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { data: rows, error } = await context.supabase
      .from("catalog_sources")
      .select("id, site_name, url, title, price, currency, image_url, last_checked_at")
      .eq("catalog_id", data.catalogId)
      .order("price", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return { sources: rows ?? [] };
  });

export const saveCatalogEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid().optional(),
        searchKey: z.string().trim().max(200).optional(),
        displayName: z.string().trim().min(2).max(200),
        category: z.string().trim().min(2).max(50),
        aliases: z.array(z.string().trim().min(2).max(100)).max(20).optional(),
        imageUrl: z.union([urlSchema, z.literal("")]).optional(),
        isActive: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const payload = {
      search_key:
        data.id && data.searchKey
          ? generateSearchKey(data.searchKey)
          : generateSearchKey(data.displayName),
      display_name: data.displayName,
      category: data.category.toUpperCase(),
      image_url: data.imageUrl || null,
      is_active: data.isActive,
      aliases: buildAliases(
        data.id && data.searchKey ? data.searchKey : data.displayName,
        data.aliases ?? [],
      ),
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("product_catalog")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: exactMatch, error: exactError } = await context.supabase
      .from("product_catalog")
      .select("id")
      .eq("search_key", payload.search_key)
      .maybeSingle();
    if (exactError) throw new Error(exactError.message);
    if (exactMatch) return { id: exactMatch.id as string };

    const { data: aliasMatch, error: aliasError } = await context.supabase
      .from("product_catalog")
      .select("id")
      .contains("aliases", [payload.search_key])
      .limit(1)
      .maybeSingle();
    if (aliasError) throw new Error(aliasError.message);
    if (aliasMatch) return { id: aliasMatch.id as string };

    // Entries created by hand in admin are curated, so they start verified.
    const { data: inserted, error } = await context.supabase
      .from("product_catalog")
      .insert({ ...payload, verification_status: "verified" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id as string };
  });

export const setCatalogVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["verified", "pending_review", "rejected"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const patch: { verification_status: string; is_active?: boolean; last_refreshed_at?: string } = {
      verification_status: data.status,
    };
    if (data.status === "verified") {
      patch.is_active = true;
      patch.last_refreshed_at = new Date().toISOString();
    }
    const { error } = await context.supabase
      .from("product_catalog")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const setCatalogEntryActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), isActive: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { error } = await context.supabase
      .from("product_catalog")
      .update({ is_active: data.isActive })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteCatalogEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    await context.supabase.from("catalog_sources").delete().eq("catalog_id", data.id);
    const { error } = await context.supabase.from("product_catalog").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const saveCatalogSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid().optional(),
        catalogId: z.string().uuid(),
        siteName: z.string().trim().min(1).max(100),
        url: urlSchema,
        title: optionalText,
        description: optionalText,
        inStock: z.boolean().optional(),
        verified: z.boolean().optional(),
        price: z.number().positive("Price must be more than 0").max(100000000),
        currency: z.string().trim().min(1).max(10),
        imageUrl: z.union([urlSchema, z.literal("")]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const payload = {
      catalog_id: data.catalogId,
      site_name: data.siteName,
      url: data.url,
      title: data.title || null,
      description: data.description || null,
      in_stock: data.inStock ?? true,
      price: Math.round(data.price),
      currency: data.currency.toUpperCase(),
      image_url: data.imageUrl || null,
      last_checked_at: new Date().toISOString(),
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("catalog_sources")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      if (data.verified !== undefined) {
        await context.supabase.from("catalog_sources").update({ verified: data.verified }).eq("id", data.id);
      }
      return { id: data.id };
    }
    // Listings added by hand in admin are curated, so they start verified.
    const { data: inserted, error } = await context.supabase
      .from("catalog_sources")
      .insert({ ...payload, verified: data.verified ?? true })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id as string };
  });

export const deleteCatalogSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { error } = await context.supabase.from("catalog_sources").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const listAdminData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    const [p, s] = await Promise.all([
      context.supabase
        .from("product_catalog")
        .select("id, search_key, display_name, category, image_url, is_active, aliases, verification_status, last_refreshed_at")
        .order("display_name")
        .limit(1000),
      context.supabase
        .from("catalog_sources")
        .select("id, catalog_id, site_name, url, title, description, price, currency, image_url, in_stock, verified, last_checked_at")
        .order("last_checked_at", { ascending: false })
        .limit(2000),
    ]);
    if (p.error) throw new Error(p.error.message);
    if (s.error) throw new Error(s.error.message);
    return { products: p.data ?? [], sources: s.data ?? [] };
  });

export const setSourceVerified = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid(), verified: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { error } = await context.supabase
      .from("catalog_sources")
      .update({ verified: data.verified })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const fetchProductLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      urls: z.array(z.string().trim().max(2000)).min(1).max(25),
      mode: z.enum(["links", "category"]).default("links"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { parseProductHtml, isSafePublicUrl, extractProductUrlsFromHtml } = await import("./link-parser");
    const UA =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
    const fetchHtml = async (url: string) => {
      if (!isSafePublicUrl(url)) return { error: "Only public http/https links are allowed" } as const;
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9" },
          redirect: "manual",
          signal: AbortSignal.timeout(10000),
        });
        if (res.status >= 300 && res.status < 400) return { error: "Page redirects elsewhere — paste the final link" } as const;
        if (!res.ok) return { error: `Store returned ${res.status}` } as const;
        return { html: (await res.text()).slice(0, 2_000_000) } as const;
      } catch (e) {
        return { error: e instanceof Error && e.name === "TimeoutError" ? "Timed out after 10s" : "Could not open page" } as const;
      }
    };
    const fetchOne = async (url: string) => {
      const page = await fetchHtml(url);
      return page.error ? { url, ok: false as const, error: page.error } : parseProductHtml(url, page.html);
    };

    let urls = data.urls;
    if (data.mode === "category") {
      if (data.urls.length !== 1) throw new Error("Enter one retailer category URL at a time");
      const sourceUrl = data.urls[0];
      if (!sourceUrl) return { results: [{ url: "", ok: false as const, error: "Enter a category URL" }] };
      if (!isSafePublicUrl(sourceUrl)) {
        return { results: [{ url: sourceUrl, ok: false as const, error: "Only public http/https links are allowed" }] };
      }
      const page = await fetchHtml(sourceUrl);
      if (page.error) return { results: [{ url: sourceUrl, ok: false as const, error: page.error }] };
      urls = extractProductUrlsFromHtml(sourceUrl, page.html, 25);
      if (urls.length === 0) {
        return { results: [{ url: sourceUrl, ok: false as const, error: "No same-store product links found on this page" }] };
      }
    }

    const results = await Promise.all(urls.map(fetchOne));
    return { results };
  });

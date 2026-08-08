import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
    z.object({ search: z.string().trim().max(200).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    let q = context.supabase
      .from("product_catalog")
      .select("id, search_key, display_name, category, image_url, is_active, search_count, last_refreshed_at")
      .order("last_searched_at", { ascending: false })
      .limit(200);
    if (data.search) q = q.ilike("display_name", `%${data.search}%`);
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
        searchKey: z.string().trim().min(2).max(200),
        displayName: z.string().trim().min(2).max(200),
        category: z.string().trim().min(2).max(50),
        imageUrl: z.union([urlSchema, z.literal("")]).optional(),
        isActive: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const payload = {
      search_key: data.searchKey.toLowerCase().replace(/\s+/g, " ").trim(),
      display_name: data.displayName,
      category: data.category.toUpperCase(),
      image_url: data.imageUrl || null,
      is_active: data.isActive,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("product_catalog")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await context.supabase
      .from("product_catalog")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id as string };
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
        price: z.number().nonnegative().max(100000000).nullable().optional(),
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
      price: data.price ?? null,
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
      return { id: data.id };
    }
    const { data: inserted, error } = await context.supabase
      .from("catalog_sources")
      .insert(payload)
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

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isListingUrl } from "./offer-filters";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 3;
const MAX_PER_CALL = 6;
export const MAX_FAILS = 5;

export type ScrapeResult = { price: number; currency: string; inStock: boolean };

export async function scrapeOne(url: string, apiKey: string): Promise<ScrapeResult | null> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        onlyMainContent: true,
        formats: [
          {
            type: "json",
            prompt:
              "Extract the current product price as a number (no currency symbols), the ISO currency code, and inStock (false if the page says out of stock, sold out, unavailable, upcoming or coming soon; otherwise true).",
            schema: {
              type: "object",
              properties: {
                price: { type: "number" },
                currency: { type: "string" },
                inStock: { type: "boolean" },
              },
              required: ["price"],
            },
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as {
      data?: { json?: { price?: number; currency?: string; inStock?: boolean } };
    };
    const j = payload.data?.json ?? {};
    if (typeof j.price !== "number" || j.price <= 0) return null;
    return {
      price: j.price,
      currency: (j.currency === "TK" ? "BDT" : (j.currency ?? "BDT")).toUpperCase().slice(0, 3),
      inStock: j.inStock !== false,
    };
  } catch (err) {
    console.error("scrapeOne failed:", err);
    return null;
  }
}

/**
 * Refresh the current user's stale sources, oldest first, a few at a time.
 * Returns how many stale sources remain so the client can call again.
 */
export const refreshUserPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) return { ok: false as const, refreshed: 0, drops: 0, remaining: 0, error: "Not configured" };

    const cutoff = new Date(Date.now() - ONE_DAY_MS).toISOString();
    const { data: sources, error } = await supabase
      .from("product_sources")
      .select("id, url, current_price, currency, product_id, last_checked_at, fail_count")
      .lt("fail_count", MAX_FAILS)
      .or(`last_checked_at.is.null,last_checked_at.lt.${cutoff}`)
      .order("last_checked_at", { ascending: true, nullsFirst: true });
    if (error) return { ok: false as const, refreshed: 0, drops: 0, remaining: 0, error: error.message };
    if (!sources || sources.length === 0) return { ok: true as const, refreshed: 0, drops: 0, remaining: 0 };

    const batch = sources.slice(0, MAX_PER_CALL);
    let refreshed = 0;
    let drops = 0;

    const handle = async (s: (typeof batch)[number]) => {
      const now = new Date().toISOString();
      const r = isListingUrl(s.url) ? null : await scrapeOne(s.url, apiKey);
      if (!r) {
        await supabase
          .from("product_sources")
          .update({ last_checked_at: now, fail_count: (s.fail_count ?? 0) + 1 })
          .eq("id", s.id);
        return;
      }
      refreshed++;
      const oldPrice = typeof s.current_price === "number" ? s.current_price : null;

      await supabase
        .from("product_sources")
        .update({
          current_price: r.price,
          currency: r.currency,
          in_stock: r.inStock,
          fail_count: 0,
          last_checked_at: now,
        })
        .eq("id", s.id);

      // Only record price history when price actually changes.
      if (oldPrice === null || r.price !== oldPrice) {
        const { data: lastEntry } = await supabase
          .from("price_history")
          .select("price")
          .eq("source_id", s.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!lastEntry || lastEntry.price !== r.price) {
          await supabase.from("price_history").insert({
            source_id: s.id,
            user_id: userId,
            price: r.price,
            currency: r.currency,
          });
        }
      }

      if (oldPrice !== null && r.price < oldPrice && r.inStock) {
        drops++;
        await supabase.from("price_alerts").insert({
          user_id: userId,
          product_id: s.product_id,
          source_id: s.id,
          old_price: oldPrice,
          new_price: r.price,
          currency: r.currency,
        });
      }
    };

    for (let i = 0; i < batch.length; i += BATCH_SIZE) {
      await Promise.all(batch.slice(i, i + BATCH_SIZE).map(handle));
    }

    return { ok: true as const, refreshed, drops, remaining: sources.length - batch.length };
  });

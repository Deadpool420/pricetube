import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function scrapeOne(url: string, apiKey: string) {
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
              "Extract the current product price as a number (no currency symbols) and the ISO currency code.",
            schema: {
              type: "object",
              properties: {
                price: { type: "number" },
                currency: { type: "string" },
              },
              required: ["price"],
            },
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as { data?: { json?: { price?: number; currency?: string } } };
    const j = payload.data?.json ?? {};
    if (typeof j.price !== "number") return null;
    return { price: j.price, currency: (j.currency ?? "BDT").toUpperCase().slice(0, 3) };
  } catch (err) {
    console.error("scrapeOne failed:", err);
    return null;
  }
}

/**
 * Refresh prices for all sources of the current user that haven't been
 * checked in the last 24 hours. Records detected drops in price_alerts.
 * Safe to call from the client on dashboard mount — it's a no-op when
 * everything is fresh.
 */
export const refreshUserPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) return { ok: false as const, refreshed: 0, drops: 0, error: "Not configured" };

    const cutoff = new Date(Date.now() - ONE_DAY_MS).toISOString();
    const { data: sources, error } = await supabase
      .from("product_sources")
      .select("id, url, current_price, currency, product_id, last_checked_at")
      .or(`last_checked_at.is.null,last_checked_at.lt.${cutoff}`);
    if (error) return { ok: false as const, refreshed: 0, drops: 0, error: error.message };
    if (!sources || sources.length === 0) return { ok: true as const, refreshed: 0, drops: 0 };

    let refreshed = 0;
    let drops = 0;
    const now = new Date().toISOString();

    await Promise.all(
      sources.map(async (s) => {
        const r = await scrapeOne(s.url, apiKey);
        if (!r) return;
        refreshed++;
        const oldPrice = typeof s.current_price === "number" ? s.current_price : null;

        await supabase
          .from("product_sources")
          .update({ current_price: r.price, currency: r.currency, last_checked_at: now })
          .eq("id", s.id);

        await supabase.from("price_history").insert({
          source_id: s.id,
          user_id: userId,
          price: r.price,
          currency: r.currency,
        });

        if (oldPrice !== null && r.price < oldPrice) {
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
      }),
    );

    return { ok: true as const, refreshed, drops };
  });

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, Search, Package, Check, Sparkles, X } from "lucide-react";
import { searchProductOffers } from "@/lib/product-search.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppHeader } from "@/components/app-header";
import { formatPrice } from "@/routes/app.index";

const searchSchema = z.object({
  q: z.string().optional(),
});

export const Route = createFileRoute("/search")({
  validateSearch: (s) => searchSchema.parse(s),
  component: SearchPage,
  head: () => ({
    meta: [
      { title: "Search products — Price Tube" },
      {
        name: "description",
        content:
          "Search any product by name. Price Tube finds every retailer selling it and compares prices side by side. No sign-up required.",
      },
      { property: "og:title", content: "Search products — Price Tube" },
      {
        property: "og:description",
        content:
          "Compare prices across Amazon, Best Buy, Walmart, eBay and more — instantly. No sign-up required.",
      },
      { property: "og:url", content: "https://pricetube.lovable.app/search" },
    ],
    links: [{ rel: "canonical", href: "https://pricetube.lovable.app/search" }],
  }),
});

type Offer = {
  url: string;
  title: string;
  price: number | null;
  currency: string;
  imageUrl: string | null;
  siteName: string;
  description: string | null;
};

function SearchPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { q } = Route.useSearch();
  const search = useServerFn(searchProductOffers);

  const [query, setQuery] = useState(q ?? "");
  const [searching, setSearching] = useState(false);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const runSearch = async (term: string) => {
    if (term.trim().length < 2) return;
    setSearching(true);
    setOffers(null);
    setSelected(new Set());
    try {
      const r = await search({ data: { query: term.trim() } });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      if (r.offers.length === 0) {
        toast.message("No results found. Try a different search.");
      }
      setOffers(r.offers);
      setSelected(
        new Set(r.offers.filter((o) => o.price !== null).slice(0, 4).map((o) => o.url)),
      );
    } catch (err) {
      console.error(err);
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  };

  // Run an initial search if ?q= is present
  useEffect(() => {
    if (q && q.trim().length >= 2) {
      runSearch(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/search", search: { q: query.trim() }, replace: true });
    runSearch(query);
  };

  const toggle = (url: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });

  const handleTrackClick = () => {
    if (selected.size === 0) {
      toast.error("Select at least one offer to track");
      return;
    }
    if (!user) {
      setShowLoginPrompt(true);
      return;
    }
    void saveSelection();
  };

  const saveSelection = async () => {
    if (!user || !offers) return;
    const picked = offers.filter((o) => selected.has(o.url));
    if (picked.length === 0) return;
    setSaving(true);
    try {
      const productName = picked[0].title || query.trim();
      const imageUrl = picked.find((o) => o.imageUrl)?.imageUrl ?? null;

      const { data: product, error: pErr } = await supabase
        .from("products")
        .insert({ user_id: user.id, name: productName, image_url: imageUrl })
        .select()
        .single();
      if (pErr) throw pErr;

      const sourceRows = picked.map((o) => ({
        product_id: product.id,
        user_id: user.id,
        site_name: o.siteName,
        url: o.url,
        current_price: o.price,
        currency: o.currency,
        last_checked_at: new Date().toISOString(),
      }));

      const { data: inserted, error: sErr } = await supabase
        .from("product_sources")
        .insert(sourceRows)
        .select();
      if (sErr) throw sErr;

      const history = inserted
        .filter((s) => typeof s.current_price === "number")
        .map((s) => ({
          source_id: s.id,
          user_id: user.id,
          price: s.current_price as number,
          currency: s.currency ?? "USD",
        }));
      if (history.length) await supabase.from("price_history").insert(history);

      toast.success(`Tracking ${productName}`);
      navigate({ to: "/app/product/$productId", params: { productId: product.id } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save product";
      console.error(err);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const loginHref = `/login?redirect=${encodeURIComponent(`/search?q=${encodeURIComponent(query.trim())}`)}`;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-6 md:py-10">
        <div className="glass-strong rounded-3xl p-4 sm:p-6 md:p-8">
          <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl md:text-3xl">
            Search any product
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            We'll scan major retailers and line up the prices. No sign-up needed to look.
          </p>


          <form onSubmit={handleSearch} className="mt-6 flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                aria-label="Search products"
                placeholder="e.g. CMF Phone 2 Pro"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-2xl glass-inset py-3 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
            <button
              type="submit"
              disabled={searching || query.trim().length < 2}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--primary)] to-[var(--deep)] px-5 py-3 text-sm font-semibold text-primary-foreground shadow-md transition hover:shadow-lg disabled:opacity-60"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </button>
          </form>

          {searching && (
            <div className="mt-6 glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
              Searching across retailers…
            </div>
          )}

          {!searching && offers && offers.length > 0 && (
            <div className="mt-6 space-y-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Found {offers.length} {offers.length === 1 ? "offer" : "offers"} · select what to track
              </div>
              <div className="grid gap-3">
                {offers.map((o) => {
                  const isSelected = selected.has(o.url);
                  return (
                    <button
                      type="button"
                      key={o.url}
                      onClick={() => toggle(o.url)}
                      className={`flex flex-col gap-3 rounded-2xl p-3 text-left transition sm:flex-row sm:items-start sm:gap-4 sm:p-4 ${
                        isSelected
                          ? "glass-strong ring-2 ring-[var(--primary)]"
                          : "glass glass-hover"
                      }`}
                    >
                      <div className="flex items-start gap-3 sm:contents">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white/40 sm:h-16 sm:w-16">
                          {o.imageUrl ? (
                            <img src={o.imageUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-muted-foreground">
                              <Package className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-xs font-medium text-[var(--deep)]">
                            {o.siteName}
                          </div>
                          <div className="line-clamp-2 mt-0.5 text-sm font-medium leading-snug break-words">
                            {o.title}
                          </div>
                          {o.description && (
                            <div className="line-clamp-1 mt-1 text-xs text-muted-foreground">
                              {o.description}
                            </div>
                          )}
                          <a
                            href={o.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 inline-block text-xs text-muted-foreground underline-offset-2 hover:underline"
                          >
                            View on {o.siteName}
                          </a>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end">
                        <div className="font-display text-lg font-bold">
                          {o.price !== null ? formatPrice(o.price, o.currency) : "—"}
                        </div>
                        <div
                          className={`grid h-7 w-7 place-items-center rounded-full border transition ${
                            isSelected
                              ? "border-[var(--primary)] bg-[var(--primary)] text-primary-foreground"
                              : "border-border bg-white/40"
                          }`}
                        >
                          {isSelected && <Check className="h-3.5 w-3.5" />}
                        </div>
                      </div>
                    </button>

                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleTrackClick}
                disabled={saving || selected.size === 0}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--primary)] to-[var(--deep)] px-4 py-3 text-sm font-semibold text-primary-foreground shadow-md transition hover:shadow-lg disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving
                  ? "Saving…"
                  : `Track ${selected.size || ""} ${selected.size === 1 ? "offer" : "offers"}`}
              </button>

              {!user && (
                <p className="text-center text-xs text-muted-foreground">
                  Browsing is free. You'll only need an account when you save a product to track it.
                </p>
              )}
            </div>
          )}

          {!searching && offers && offers.length === 0 && (
            <div className="mt-6 glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
              No offers found. Try a more specific name.
            </div>
          )}
        </div>
      </main>

      {showLoginPrompt && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setShowLoginPrompt(false)}
        >
          <div
            className="glass-strong relative w-full max-w-md rounded-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowLoginPrompt(false)}
              aria-label="Close"
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full glass-inset text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--primary)] text-primary-foreground shadow-md">
              <Sparkles className="h-5 w-5" />
            </div>
            <h2 className="mt-4 font-display text-xl font-bold tracking-tight">
              Create a free account to save this
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign up in 30 seconds to track {selected.size === 1 ? "this offer" : `these ${selected.size} offers`} and watch the price history. No credit card.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <a
                href={loginHref}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--primary)] to-[var(--deep)] px-4 py-3 text-sm font-semibold text-primary-foreground shadow-md transition hover:shadow-lg"
              >
                Sign in / Sign up
              </a>
              <button
                onClick={() => setShowLoginPrompt(false)}
                className="rounded-2xl glass-inset px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Keep browsing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

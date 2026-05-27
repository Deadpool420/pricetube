import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  Link as LinkIcon,
  Search,
  Package,
  Check,
} from "lucide-react";
import { scrapeProductFromUrl } from "@/lib/price-scraping.functions";
import { searchProductOffers } from "@/lib/product-search.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatPrice } from "@/routes/app.index";

export const Route = createFileRoute("/app/add")({
  component: AddProduct,
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

function AddProduct() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const scrape = useServerFn(scrapeProductFromUrl);
  const search = useServerFn(searchProductOffers);

  const [mode, setMode] = useState<"search" | "manual">("search");

  // search state
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // manual state
  const [name, setName] = useState("");
  const [urls, setUrls] = useState<string[]>([""]);

  const [saving, setSaving] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    setOffers(null);
    setSelected(new Set());
    try {
      const r = await search({ data: { query: query.trim() } });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      if (r.offers.length === 0) {
        toast.message("No results found. Try a different search.");
      }
      setOffers(r.offers);
      // preselect ones with a price
      setSelected(new Set(r.offers.filter((o) => o.price !== null).slice(0, 4).map((o) => o.url)));
    } catch (err) {
      console.error(err);
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  };

  const toggle = (url: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });

  const saveFromSelection = async () => {
    if (!user || !offers) return;
    const picked = offers.filter((o) => selected.has(o.url));
    if (picked.length === 0) {
      toast.error("Select at least one offer to track");
      return;
    }
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

  const saveFromUrls = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const cleanUrls = urls.map((u) => u.trim()).filter(Boolean);
    if (cleanUrls.length === 0) {
      toast.error("Add at least one product URL");
      return;
    }
    setSaving(true);
    try {
      toast.message("Fetching prices…");
      const scraped = await Promise.all(
        cleanUrls.map((url) => scrape({ data: { url } }).then((r) => ({ url, ...r }))),
      );
      const successful = scraped.filter((s) => s.ok);
      if (successful.length === 0) {
        toast.error("Couldn't fetch any prices. Check the URLs and try again.");
        return;
      }
      const productName =
        name.trim() || (successful[0].ok ? successful[0].title : "Untitled product");
      const imageUrl = successful.find((s) => s.ok && s.imageUrl)?.imageUrl ?? null;

      const { data: product, error: pErr } = await supabase
        .from("products")
        .insert({ user_id: user.id, name: productName, image_url: imageUrl })
        .select()
        .single();
      if (pErr) throw pErr;

      const sourceRows = successful.map((s) => ({
        product_id: product.id,
        user_id: user.id,
        site_name: s.ok ? s.siteName : "Unknown",
        url: s.url,
        current_price: s.ok ? s.price : null,
        currency: s.ok ? s.currency : "USD",
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

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link
        to="/app"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="glass-strong rounded-3xl p-6 md:p-8">
        <h1 className="font-display text-2xl font-bold tracking-tight">Track a new product</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search by name and pick which stores to watch — or paste your own links.
        </p>

        <div className="mt-5 inline-flex rounded-full glass-inset p-1 text-xs font-medium">
          <button
            onClick={() => setMode("search")}
            className={`rounded-full px-4 py-1.5 transition ${
              mode === "search" ? "bg-white/70 text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Search
          </button>
          <button
            onClick={() => setMode("manual")}
            className={`rounded-full px-4 py-1.5 transition ${
              mode === "manual" ? "bg-white/70 text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Paste links
          </button>
        </div>

        {mode === "search" ? (
          <div className="mt-6 space-y-5">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
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
              <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
                Searching across retailers…
              </div>
            )}

            {!searching && offers && offers.length > 0 && (
              <>
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
                        className={`flex items-start gap-4 rounded-2xl p-4 text-left transition ${
                          isSelected
                            ? "glass-strong ring-2 ring-[var(--primary)]"
                            : "glass glass-hover"
                        }`}
                      >
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/40">
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
                          <div className="line-clamp-2 mt-0.5 text-sm font-medium leading-snug">
                            {o.title}
                          </div>
                          {o.description && (
                            <div className="line-clamp-1 mt-1 text-xs text-muted-foreground">
                              {o.description}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="font-display text-lg font-bold">
                            {o.price !== null ? formatPrice(o.price, o.currency) : "—"}
                          </div>
                          <div
                            className={`grid h-6 w-6 place-items-center rounded-full border transition ${
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
                  onClick={saveFromSelection}
                  disabled={saving || selected.size === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--primary)] to-[var(--deep)] px-4 py-3 text-sm font-semibold text-primary-foreground shadow-md transition hover:shadow-lg disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving
                    ? "Saving…"
                    : `Track ${selected.size || ""} ${selected.size === 1 ? "offer" : "offers"}`}
                </button>
              </>
            )}

            {!searching && offers && offers.length === 0 && (
              <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
                No offers found. Try a more specific name, or paste links manually.
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={saveFromUrls} className="mt-6 space-y-5">
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Custom name (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. AirPods Pro 2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-2xl glass-inset px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Product URLs
              </label>
              <div className="mt-1.5 space-y-2">
                {urls.map((u, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="url"
                        placeholder="https://www.amazon.com/..."
                        value={u}
                        onChange={(e) =>
                          setUrls((arr) => arr.map((x, idx) => (idx === i ? e.target.value : x)))
                        }
                        className="w-full rounded-2xl glass-inset py-3 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
                      />
                    </div>
                    {urls.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setUrls((arr) => arr.filter((_, idx) => idx !== i))}
                        className="grid h-10 w-10 place-items-center rounded-2xl glass-inset text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setUrls((u) => [...u, ""])}
                className="mt-2 inline-flex items-center gap-1 rounded-full glass-inset px-3 py-1.5 text-xs font-medium"
              >
                <Plus className="h-3.5 w-3.5" /> Add another source
              </button>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--primary)] to-[var(--deep)] px-4 py-3 text-sm font-semibold text-primary-foreground shadow-md transition hover:shadow-lg disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Fetching prices…" : "Start tracking"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

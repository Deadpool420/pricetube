import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Heart, Loader2, RefreshCw, Trash2, Pencil, Plus, Search, AlertTriangle } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { scrapeProductFromUrl } from "@/lib/price-scraping.functions";
import { searchProductOffers } from "@/lib/product-search.functions";
import { formatPrice } from "./app.index";

export const Route = createFileRoute("/app/product/$productId")({
  component: ProductDetail,
  head: () => ({
    meta: [
      { title: "Product detail — Price Tube" },
      { name: "description", content: "Compare prices and watch the history for a tracked product across stores." },
      { property: "og:title", content: "Product detail — Price Tube" },
      { property: "og:description", content: "Compare prices and watch the history for a tracked product across stores." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ProductDetail() {
  const { productId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const scrape = useServerFn(scrapeProductFromUrl);
  const searchOffers = useServerFn(searchProductOffers);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editQuery, setEditQuery] = useState("");
  const [editSearching, setEditSearching] = useState(false);
  const [editResults, setEditResults] = useState<any[]>([]);
  const [addingUrl, setAddingUrl] = useState<string | null>(null);



  const { data, isLoading } = useQuery({
    queryKey: ["product", productId],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: product }, { data: sources }, { data: wish }] = await Promise.all([
        supabase.from("products").select("*").eq("id", productId).single(),
        supabase.from("product_sources").select("*").eq("product_id", productId).order("current_price", { ascending: true, nullsFirst: false }),
        supabase.from("wishlist").select("product_id").eq("product_id", productId).maybeSingle(),
      ]);
      const sourceIds = (sources ?? []).map((s) => s.id);
      const { data: history } = sourceIds.length
        ? await supabase.from("price_history").select("*").in("source_id", sourceIds).order("recorded_at")
        : { data: [] as any[] };
      return { product, sources: sources ?? [], history: history ?? [], wished: !!wish };
    },
  });

  const refresh = async () => {
    if (!data || !user) return;
    setRefreshing(true);
    try {
      const results = await Promise.all(
        data.sources.map((s) => scrape({ data: { url: s.url } }).then((r) => ({ source: s, ...r }))),
      );
      for (const r of results) {
        if (!r.ok || typeof r.price !== "number") continue;
        await supabase
          .from("product_sources")
          .update({ current_price: r.price, currency: r.currency, last_checked_at: new Date().toISOString() })
          .eq("id", r.source.id);
        await supabase.from("price_history").insert({
          source_id: r.source.id,
          user_id: user.id,
          price: r.price,
          currency: r.currency,
        });
      }
      toast.success("Prices refreshed");
      qc.invalidateQueries({ queryKey: ["product", productId] });
    } catch (err: any) {
      toast.error(err?.message ?? "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const toggleWishlist = async () => {
    if (!user || !data) return;
    if (data.wished) {
      await supabase.from("wishlist").delete().eq("product_id", productId).eq("user_id", user.id);
    } else {
      await supabase.from("wishlist").insert({ product_id: productId, user_id: user.id });
    }
    qc.invalidateQueries({ queryKey: ["product", productId] });
    qc.invalidateQueries({ queryKey: ["wishlist"] });
  };

  const deleteProduct = async () => {
    await supabase.from("products").delete().eq("id", productId);
    toast.success("Product deleted");
    setConfirmDelete(false);
    navigate({ to: "/app" });
  };

  const removeSource = async (sourceId: string) => {
    await supabase.from("price_history").delete().eq("source_id", sourceId);
    const { error } = await supabase.from("product_sources").delete().eq("id", sourceId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Source removed");
    qc.invalidateQueries({ queryKey: ["product", productId] });
  };

  const runEditSearch = async () => {
    const store = editQuery.trim();
    if (store.length < 2 || !data?.product) return;
    const term = `${data.product.name} ${store}`.trim();
    setEditSearching(true);
    try {
      const r = await searchOffers({ data: { query: term } });
      if (r.ok) {
        // Sort: priced offers first (cheapest first), unknown prices last
        const sorted = [...r.offers].sort((a, b) => {
          const ap = typeof a.price === "number" && a.price > 0 ? a.price : Number.POSITIVE_INFINITY;
          const bp = typeof b.price === "number" && b.price > 0 ? b.price : Number.POSITIVE_INFINITY;
          return ap - bp;
        });
        setEditResults(sorted);
      } else toast.error(r.error ?? "Search failed");
    } catch (err: any) {
      toast.error(err?.message ?? "Search failed");
    } finally {
      setEditSearching(false);
    }
  };

  const addSource = async (offer: { url: string; siteName: string; price: number | null; currency: string }) => {
    if (!user) return;
    if (data?.sources.some((s) => s.url === offer.url)) {
      toast.info("That source is already tracked");
      return;
    }
    setAddingUrl(offer.url);
    try {
      const { data: inserted, error } = await supabase
        .from("product_sources")
        .insert({
          product_id: productId,
          user_id: user.id,
          site_name: offer.siteName,
          url: offer.url,
          current_price: offer.price,
          currency: offer.currency,
          last_checked_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) throw error;
      if (typeof offer.price === "number" && inserted) {
        await supabase.from("price_history").insert({
          source_id: inserted.id,
          user_id: user.id,
          price: offer.price,
          currency: offer.currency,
        });
      }
      toast.success(`Added ${offer.siteName}`);
      qc.invalidateQueries({ queryKey: ["product", productId] });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to add source");
    } finally {
      setAddingUrl(null);
    }
  };



  if (isLoading || !data?.product) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="glass rounded-3xl p-10 text-center text-sm text-muted-foreground">Loading…</div>
      </main>
    );
  }

  const prices = data.sources
    .map((s) => s.current_price)
    .filter((p): p is number => typeof p === "number" && p > 0);
  const lowest = prices.length ? Math.min(...prices) : null;
  const currency = data.sources[0]?.currency ?? "USD";

  // Build chart data: pivot history by recorded date per source
  const chartData = buildChartData(data.history, data.sources);

  return (
    <main className="page-enter mx-auto w-full max-w-4xl overflow-x-hidden px-4 py-10">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Link to="/app" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <TooltipProvider delayDuration={200}>
          <div className="flex items-center gap-3">
            {[
              {
                key: "wish",
                label: data.wished ? "Remove from wishlist" : "Add to wishlist",
                onClick: toggleWishlist,
                icon: <Heart className={`h-4 w-4 ${data.wished ? "fill-current" : ""}`} />,
                className: data.wished ? "text-destructive" : "text-muted-foreground",
              },
              {
                key: "refresh",
                label: "Refresh prices",
                onClick: refresh,
                disabled: refreshing,
                icon: refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />,
                className: "text-muted-foreground",
              },
              {
                key: "edit",
                label: "Edit sources",
                onClick: () => setEditOpen(true),
                icon: <Pencil className="h-4 w-4" />,
                className: "text-muted-foreground",
              },
              {
                key: "delete",
                label: "Delete product",
                onClick: () => setConfirmDelete(true),
                icon: <Trash2 className="h-4 w-4" />,
                className: "text-muted-foreground hover:text-destructive",
              },
            ].map((btn) => (
              <UITooltip key={btn.key}>
                <TooltipTrigger asChild>
                  <button
                    onClick={btn.onClick}
                    disabled={btn.disabled}
                    aria-label={btn.label}
                    className={`grid h-11 w-11 place-items-center rounded-full glass-inset transition disabled:opacity-60 ${btn.className}`}
                  >
                    {btn.icon}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{btn.label}</TooltipContent>
              </UITooltip>
            ))}
          </div>
        </TooltipProvider>
      </div>

      <div className="glass-strong rounded-3xl p-5 sm:p-6">
        <div className="flex items-start gap-5">
          {data.product.image_url && (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/70 p-2 shadow-md">
              <img src={data.product.image_url} alt="" className="h-full w-full object-contain" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-bold tracking-tight break-words sm:text-2xl">{data.product.name}</h1>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <div className="font-display text-2xl font-bold text-gradient break-words sm:text-3xl md:text-4xl">
                {lowest !== null ? formatPrice(lowest, currency) : <span className="text-base text-muted-foreground">Price unavailable</span>}
              </div>
              {lowest !== null && <div className="text-xs text-muted-foreground">lowest right now</div>}
            </div>
          </div>
        </div>
      </div>

      <h2 className="mt-8 mb-3 px-1 font-display text-lg font-semibold">Prices right now</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {data.sources.map((s) => {
          const isLowest = s.current_price === lowest;
          const suspicious = (s as unknown as { suspicious_price?: boolean }).suspicious_price === true;
          return (
            <div
              key={s.id}
              className={`glass glass-hover min-w-0 overflow-hidden rounded-2xl p-5 sm:p-6 ${isLowest ? "ring-2 ring-[var(--success)]/60" : ""}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs uppercase tracking-wide text-muted-foreground">{s.site_name}</div>
                  <div className="mt-1 min-w-0 font-display text-xl font-bold break-words sm:text-2xl">
                    {typeof s.current_price === "number" && s.current_price > 0
                      ? formatPrice(s.current_price, s.currency ?? "USD")
                      : <span className="text-sm font-medium text-muted-foreground">Price unavailable</span>}
                  </div>
                  {suspicious && (
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                      <AlertTriangle className="h-3 w-3" /> Price may be inaccurate
                    </div>
                  )}
                </div>
                <a
                  href={/^https?:\/\//i.test(s.url) ? s.url : "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--deep)] px-3 py-1.5 text-xs font-medium text-primary-foreground"
                >
                  Buy <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          );
        })}
      </div>


      {chartData.length > 1 && (
        <>
          <h2 className="mt-8 mb-3 px-1 font-display text-lg font-semibold">Price over time</h2>
          <div className="glass rounded-3xl p-5 overflow-x-hidden">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    {data.sources.map((s, i) => (
                      <linearGradient key={s.id} id={`pt-grad-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={`var(--chart-${(i % 5) + 1})`} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={`var(--chart-${(i % 5) + 1})`} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid stroke="oklch(0.9 0.02 230 / 0.5)" vertical={false} strokeDasharray="3 6" />
                  <XAxis
                    dataKey="label"
                    stroke="oklch(0.6 0.02 240)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    stroke="oklch(0.6 0.02 240)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={72}
                    tickFormatter={(v) => {
                      const n = Number(v);
                      if (n > 99999) return `${Math.round(n / 1000)}K`;
                      return formatPrice(n, currency);
                    }}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    cursor={{ stroke: "var(--primary)", strokeWidth: 1.5 }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      // Dedupe by name, keeping highest-priced entry.
                      const byName = new Map<string, { value: number; color: string; count: number }>();
                      for (const p of payload) {
                        if (typeof p.value !== "number") continue;
                        const name = String(p.name);
                        const existing = byName.get(name);
                        if (!existing) byName.set(name, { value: p.value, color: p.color as string, count: 1 });
                        else {
                          existing.count += 1;
                          if (p.value > existing.value) existing.value = p.value;
                        }
                      }
                      const sorted = Array.from(byName.entries()).sort((a, b) => b[1].value - a[1].value);
                      return (
                        <div className="rounded-xl border border-white/60 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur-xl">
                          <div className="mb-1 font-medium text-muted-foreground">{label}</div>
                          {sorted.map(([name, v]) => (
                            <div key={name} className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full" style={{ background: v.color }} />
                              <span className="text-foreground">
                                {name}
                                {v.count > 1 && <span className="ml-1 text-muted-foreground">({v.count} listings)</span>}
                              </span>
                              <span className="ml-auto font-semibold">{formatPrice(v.value, currency)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  {data.sources.map((s, i) => (
                    <Area
                      key={s.id}
                      type="monotone"
                      dataKey={s.site_name}
                      stroke={`var(--chart-${(i % 5) + 1})`}
                      strokeWidth={2}
                      fill={`url(#pt-grad-${s.id})`}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: "white" }}
                      dot={false}
                      connectNulls
                      animationDuration={300}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>

            </div>
          </div>
        </>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="glass-strong flex max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-lg flex-col overflow-hidden rounded-3xl border-white/40 p-4 shadow-2xl sm:p-6">
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle className="font-display text-lg leading-tight sm:text-xl">Edit tracked sources</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground sm:text-sm">
              Remove a store or add a new one to track for this product.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current sources</h3>
              <div className="space-y-2">
                {data.sources.length === 0 ? (
                  <p className="rounded-2xl glass-inset px-3 py-3 text-sm text-muted-foreground">No sources yet.</p>
                ) : (
                  data.sources.map((s) => (
                    <div key={s.id} className="flex w-full items-center gap-2 overflow-hidden rounded-2xl glass-inset px-3 py-2.5">
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="truncate text-sm font-medium">{s.site_name}</div>
                        <div className="truncate text-[11px] text-muted-foreground">{getDomain(s.url)}</div>
                      </div>
                      <button
                        onClick={() => removeSource(s.id)}
                        aria-label={`Remove ${s.site_name}`}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full glass-inset text-muted-foreground transition hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add a new source</h3>
              <div className="mt-3 space-y-2">
                {editResults.map((o) => {
                  const already = data.sources.some((s) => s.url === o.url);
                  const hasPrice = typeof o.price === "number" && o.price > 0;
                  return (
                    <div key={o.url} className="flex w-full items-center gap-2 overflow-hidden rounded-2xl glass-inset px-3 py-2.5">
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="truncate text-sm font-medium">{o.siteName}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {hasPrice ? formatPrice(o.price, o.currency) : "Price unknown"} · {getDomain(o.url)}
                        </div>
                      </div>
                      <button
                        onClick={() => addSource(o)}
                        disabled={already || addingUrl === o.url}
                        aria-label={already ? "Already added" : `Add ${o.siteName}`}
                        className="flex shrink-0 items-center gap-1 rounded-full bg-brand-gradient px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm disabled:opacity-50"
                      >
                        {addingUrl === o.url ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                        {already ? "Added" : "Add"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sticky bottom search */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runEditSearch();
            }}
            className="mt-3 flex shrink-0 items-center gap-2 overflow-hidden rounded-2xl glass-inset px-3 py-2"
          >
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={editQuery}
              onChange={(e) => setEditQuery(e.target.value)}
              placeholder="Add store (e.g. Sumash Tech)"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={editSearching || editQuery.trim().length < 2}
              className="shrink-0 rounded-full bg-brand-gradient px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm disabled:opacity-50"
            >
              {editSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Search"}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="glass-strong rounded-3xl border-white/40 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl">Delete this product?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This removes the product and all of its price history. You can't undo this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-full border-0 bg-brand-gradient px-5 text-primary-foreground shadow-md hover:opacity-95 hover:text-primary-foreground">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteProduct}
              className="rounded-full px-5 shadow-md bg-[rgb(220_38_38_/_0.92)] text-white hover:bg-[rgb(220_38_38_/_1)]"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}


function buildChartData(history: any[], sources: any[]) {
  const byDate = new Map<string, Record<string, any>>();
  const sourceById = new Map(sources.map((s) => [s.id, s.site_name]));
  for (const h of history) {
    const date = new Date(h.recorded_at);
    const label = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const row = byDate.get(label) ?? { label };
    const name = sourceById.get(h.source_id);
    if (name) row[name] = Number(h.price);
    byDate.set(label, row);
  }
  return Array.from(byDate.values());
}

function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Heart, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { scrapeProductFromUrl } from "@/lib/price-scraping.functions";
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
  const [confirmDelete, setConfirmDelete] = useState(false);

function ProductDetail() {
  const { productId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const scrape = useServerFn(scrapeProductFromUrl);
  const [refreshing, setRefreshing] = useState(false);

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
    if (!confirm("Delete this product and all its price history?")) return;
    await supabase.from("products").delete().eq("id", productId);
    toast.success("Product deleted");
    navigate({ to: "/app" });
  };

  if (isLoading || !data?.product) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="glass rounded-3xl p-10 text-center text-sm text-muted-foreground">Loading…</div>
      </main>
    );
  }

  const prices = data.sources.map((s) => s.current_price).filter((p): p is number => typeof p === "number");
  const lowest = prices.length ? Math.min(...prices) : null;
  const currency = data.sources[0]?.currency ?? "USD";

  // Build chart data: pivot history by recorded date per source
  const chartData = buildChartData(data.history, data.sources);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link to="/app" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleWishlist}
            className={`grid h-10 w-10 place-items-center rounded-full glass-inset transition ${data.wished ? "text-destructive" : "text-muted-foreground"}`}
            aria-label="Toggle wishlist"
          >
            <Heart className={`h-4 w-4 ${data.wished ? "fill-current" : ""}`} />
          </button>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-full glass-inset px-4 py-2 text-xs font-medium hover:bg-white/80 transition disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </button>
          <button
            onClick={deleteProduct}
            className="grid h-10 w-10 place-items-center rounded-full glass-inset text-muted-foreground hover:text-destructive transition"
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="glass-strong rounded-3xl p-6 md:p-8">
        <div className="flex items-start gap-5">
          {data.product.image_url && (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/70 p-2 shadow-md">
              <img src={data.product.image_url} alt="" className="h-full w-full object-contain" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold tracking-tight">{data.product.name}</h1>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <div className="font-display text-3xl font-bold text-gradient break-all md:text-4xl">
                {lowest !== null ? formatPrice(lowest, currency) : "—"}
              </div>
              <div className="text-xs text-muted-foreground">lowest right now</div>
            </div>
          </div>
        </div>
      </div>

      <h2 className="mt-8 mb-3 font-display text-lg font-semibold">Compare sources</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {data.sources.map((s) => {
          const isLowest = s.current_price === lowest;
          return (
            <div
              key={s.id}
              className={`glass glass-hover rounded-2xl p-5 ${isLowest ? "ring-2 ring-[var(--success)]/60" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.site_name}</div>
                  <div className="mt-1 font-display text-2xl font-bold">
                    {typeof s.current_price === "number" ? formatPrice(s.current_price, s.currency ?? "USD") : "—"}
                  </div>
                </div>
                <a
                  href={/^https?:\/\//i.test(s.url) ? s.url : "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--deep)] px-3 py-1.5 text-xs font-medium text-primary-foreground"
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
          <h2 className="mt-8 mb-3 font-display text-lg font-semibold">Price history</h2>
          <div className="glass rounded-3xl p-5">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid stroke="oklch(0.85 0.03 230 / 0.4)" vertical={false} />
                  <XAxis dataKey="label" stroke="oklch(0.5 0.03 240)" fontSize={11} />
                  <YAxis stroke="oklch(0.5 0.03 240)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "oklch(1 0 0 / 0.85)",
                      backdropFilter: "blur(20px)",
                      border: "1px solid oklch(0.85 0.03 230 / 0.5)",
                      borderRadius: 12,
                    }}
                  />
                  {data.sources.map((s, i) => (
                    <Line
                      key={s.id}
                      type="monotone"
                      dataKey={s.site_name}
                      stroke={`var(--chart-${(i % 5) + 1})`}
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
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

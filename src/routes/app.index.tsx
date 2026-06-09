import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Plus, Package, TrendingDown, Heart, ArrowDown, ArrowUp, Clock, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { refreshUserPrices } from "@/lib/price-refresh.functions";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Your tracker — Price Tube" },
      { name: "description", content: "All the products you're watching and their lowest live prices in one place." },
      { property: "og:title", content: "Your tracker — Price Tube" },
      { property: "og:description", content: "All the products you're watching and their lowest live prices in one place." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type DashboardProduct = {
  id: string;
  name: string;
  image_url: string | null;
  created_at: string;
  product_sources: {
    id: string;
    site_name: string;
    current_price: number | null;
    currency: string | null;
    last_checked_at: string | null;
    price_history: { price: number; recorded_at: string }[];
  }[];
  wishlist: { product_id: string }[];
};

function Dashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const refresh = useServerFn(refreshUserPrices);
  const triggered = useRef(false);
  const [q, setQ] = useState("");
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    const key = `pt-last-refresh-${user.id}`;
    const v = Number(localStorage.getItem(key) || 0);
    setLastRefresh(v || null);
  }, [user]);

  const lastRefreshLabel = lastRefresh ? timeAgo(new Date(lastRefresh).toISOString()) : null;

  const { data: products, isLoading, error, refetch } = useQuery({
    queryKey: ["products", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<DashboardProduct[]> => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, name, image_url, created_at, product_sources(id, site_name, current_price, currency, last_checked_at, price_history(price, recorded_at)), wishlist(product_id)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DashboardProduct[];
    },
  });

  // Auto-refresh: once per user per day (client-side throttle), server also no-ops if all fresh.
  useEffect(() => {
    if (!user || triggered.current) return;
    const key = `pt-last-refresh-${user.id}`;
    const last = Number(localStorage.getItem(key) || 0);
    if (Date.now() - last < 24 * 60 * 60 * 1000) return;
    triggered.current = true;
    refresh({}).then((r) => {
      if (r.ok) {
        const now = Date.now();
        localStorage.setItem(key, String(now));
        setLastRefresh(now);
        if (r.refreshed > 0) qc.invalidateQueries({ queryKey: ["products", user.id] });
      }
    });
  }, [user, refresh, qc]);

  const toggleWishlist = async (productId: string, currentlyWished: boolean) => {
    if (!user) return;
    if (currentlyWished) {
      await supabase.from("wishlist").delete().eq("product_id", productId).eq("user_id", user.id);
    } else {
      await supabase.from("wishlist").insert({ product_id: productId, user_id: user.id });
    }
    qc.invalidateQueries({ queryKey: ["products", user.id] });
    qc.invalidateQueries({ queryKey: ["wishlist"] });
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">Your tracker</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {products?.length ?? 0} {products?.length === 1 ? "product" : "products"} watched
            {lastRefreshLabel ? <span className="text-muted-foreground/80"> · Last updated {lastRefreshLabel}</span> : null}
          </p>
        </div>
        <Link
          to="/app/add"
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:shadow-lg transition"
        >
          <Plus className="h-4 w-4" /> Track product
        </Link>
      </div>

      {/* Search shortcut */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const term = q.trim();
          if (term.length < 2) return;
          navigate({ to: "/search", search: { q: term } });
        }}
        className="mb-6 sm:mb-8"
      >
        <div className="glass-strong rounded-2xl p-2">
          <div className="flex items-center gap-2 rounded-xl glass-inset px-3 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              aria-label="Search for a new product"
              placeholder="Search any product to track…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={q.trim().length < 2}
              className="rounded-full bg-brand-gradient px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:shadow disabled:opacity-50"
            >
              Search
            </button>
          </div>
        </div>
      </form>


      {isLoading ? (
        <div className="glass rounded-3xl p-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : !products || products.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} onToggleWishlist={toggleWishlist} />
          ))}
        </div>
      )}
    </main>
  );
}

function ProductCard({
  product,
  onToggleWishlist,
}: {
  product: DashboardProduct;
  onToggleWishlist: (id: string, wished: boolean) => void;
}) {
  const prices = product.product_sources
    .map((s) => s.current_price)
    .filter((p): p is number => typeof p === "number");
  const lowest = prices.length ? Math.min(...prices) : null;
  const lowestSource = product.product_sources.find((s) => s.current_price === lowest);
  const currency = lowestSource?.currency ?? "USD";
  const wished = (product.wishlist?.length ?? 0) > 0;

  let trend: "down" | "up" | null = null;
  let delta = 0;
  if (lowestSource && typeof lowestSource.current_price === "number") {
    const history = lowestSource.price_history ?? [];
    const prior = history.find((h) => Number(h.price) !== lowestSource.current_price);
    if (prior) {
      const diff = lowestSource.current_price - Number(prior.price);
      if (diff < 0) {
        trend = "down";
        delta = Math.abs(Math.round(diff));
      } else if (diff > 0) {
        trend = "up";
        delta = Math.round(diff);
      }
    }
  }

  const symbol = (() => {
    try {
      const parts = new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: (currency || "USD").toUpperCase(),
      }).formatToParts(0);
      return parts.find((p) => p.type === "currency")?.value ?? "$";
    } catch {
      return "$";
    }
  })();

  const lastChecked = product.product_sources
    .map((s) => s.last_checked_at)
    .filter((d): d is string => !!d)
    .sort()
    .at(-1);

  return (
    <div className="glass glass-hover relative block rounded-3xl p-5">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onToggleWishlist(product.id, wished);
        }}
        aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
        className={`absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full glass-inset transition active:scale-95 ${
          wished ? "text-destructive" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Heart className={`h-4 w-4 ${wished ? "fill-current" : ""}`} />
      </button>

      <Link to="/app/product/$productId" params={{ productId: product.id }} className="block">
        <div className="flex items-start gap-4 pr-10">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/60 p-1.5">
            {product.image_url ? (
              <img src={product.image_url} alt="" className="h-full w-full object-contain" />
            ) : (
              <div className="grid h-full w-full place-items-center text-muted-foreground">
                <Package className="h-6 w-6" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="line-clamp-2 font-display text-sm font-semibold leading-tight break-words">
              {product.name}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {product.product_sources.length} {product.product_sources.length === 1 ? "source" : "sources"}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              Lowest
              {trend === "down" && (
                <span className="inline-flex items-center gap-0.5 rounded-full glass-inset px-2 py-0.5 text-[10px] font-semibold normal-case text-[color:var(--success)]">
                  <ArrowDown className="h-3 w-3" /> {symbol}{delta}
                </span>
              )}
              {trend === "up" && (
                <span className="inline-flex items-center gap-0.5 rounded-full glass-inset px-2 py-0.5 text-[10px] font-semibold normal-case text-[color:var(--destructive)]">
                  <ArrowUp className="h-3 w-3" /> {symbol}{delta}
                </span>
              )}
            </div>
            <div className="font-display text-2xl font-bold text-gradient break-words">
              {lowest !== null ? formatPrice(lowest, currency) : "—"}
            </div>
          </div>

          {lowestSource && (
            <div className="flex shrink-0 items-center gap-1 rounded-full glass-inset px-2 py-1 text-xs font-medium text-[var(--primary)]">
              <TrendingDown className="h-3 w-3" />
              <span className="max-w-[80px] truncate">{lowestSource.site_name}</span>
            </div>
          )}
        </div>

        {lastChecked && (
          <div className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" /> Updated {timeAgo(lastChecked)}
          </div>
        )}
      </Link>
    </div>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function EmptyState() {
  return (
    <div className="glass-strong rounded-3xl p-8 sm:p-12 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--primary)] text-primary-foreground shadow-md">
        <Heart className="h-6 w-6" />
      </div>
      <h2 className="font-display text-xl font-semibold">Nothing tracked yet</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Search a product or paste a link to start watching its price.
      </p>
      <Link
        to="/app/add"
        className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--deep)] px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md"
      >
        <Plus className="h-4 w-4" /> Add your first product
      </Link>
    </div>
  );
}

export function formatPrice(value: number, currency: string) {
  const rounded = Math.round(value);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (currency || "USD").toUpperCase(),
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(rounded);
  } catch {
    return `${rounded} ${currency}`;
  }
}

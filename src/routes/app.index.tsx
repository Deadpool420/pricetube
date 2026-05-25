import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Package, TrendingDown, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
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
  }[];
};

function Dashboard() {
  const { user } = useAuth();

  const { data: products, isLoading } = useQuery({
    queryKey: ["products", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<DashboardProduct[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, image_url, created_at, product_sources(id, site_name, current_price, currency)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as DashboardProduct[];
    },
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Your tracker</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {products?.length ?? 0} {products?.length === 1 ? "product" : "products"} watched
          </p>
        </div>
        <Link
          to="/app/add"
          className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--deep)] px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:shadow-lg transition"
        >
          <Plus className="h-4 w-4" /> Track product
        </Link>
      </div>

      {isLoading ? (
        <div className="glass rounded-3xl p-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : !products || products.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </main>
  );
}

function ProductCard({ product }: { product: DashboardProduct }) {
  const prices = product.product_sources
    .map((s) => s.current_price)
    .filter((p): p is number => typeof p === "number");
  const lowest = prices.length ? Math.min(...prices) : null;
  const lowestSource = product.product_sources.find((s) => s.current_price === lowest);
  const currency = lowestSource?.currency ?? "USD";

  return (
    <Link
      to="/app/product/$productId"
      params={{ productId: product.id }}
      className="glass glass-hover block rounded-3xl p-5"
    >
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-white/40">
          {product.image_url ? (
            <img src={product.image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-muted-foreground">
              <Package className="h-6 w-6" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 font-display text-sm font-semibold leading-tight">{product.name}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {product.product_sources.length} {product.product_sources.length === 1 ? "source" : "sources"}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Lowest</div>
          <div className="font-display text-2xl font-bold text-gradient">
            {lowest !== null ? formatPrice(lowest, currency) : "—"}
          </div>
        </div>
        {lowestSource && (
          <div className="flex items-center gap-1 rounded-full bg-[oklch(0.9_0.1_160/0.5)] px-2 py-1 text-xs font-medium text-[oklch(0.4_0.13_160)]">
            <TrendingDown className="h-3 w-3" />
            {lowestSource.site_name}
          </div>
        )}
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="glass-strong rounded-3xl p-12 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--primary)] text-primary-foreground shadow-md">
        <Heart className="h-6 w-6" />
      </div>
      <h2 className="font-display text-xl font-semibold">Nothing tracked yet</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Paste a link to any product page to start watching its price.
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
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (currency || "USD").toUpperCase(),
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

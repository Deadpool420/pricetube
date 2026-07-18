import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatPrice } from "./app.index";

export const Route = createFileRoute("/app/wishlist")({
  component: Wishlist,
  head: () => ({
    meta: [
      { title: "Wishlist — Price Tube" },
      { name: "description", content: "Products you've starred and want to keep an eye on." },
      { property: "og:title", content: "Wishlist — Price Tube" },
      { property: "og:description", content: "Products you've starred and want to keep an eye on." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function Wishlist() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["wishlist", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wishlist")
        .select("product_id, products(id, name, image_url, product_sources(site_name, current_price, currency))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  return (
    <main className="page-enter mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Wishlist</h1>
      <p className="mt-1 text-sm text-muted-foreground">Products you're keeping an eye on.</p>

      <div className="mt-8">
        {isLoading ? (
          <div className="glass rounded-3xl p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : !data || data.length === 0 ? (
          <div className="glass-strong rounded-3xl p-12 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--primary)] text-primary-foreground shadow-md">
              <Heart className="h-6 w-6" />
            </div>
            <h2 className="font-display text-xl font-semibold">No favorites yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">Tap the heart on any product to save it here.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.map((row) => {
              const p = row.products;
              if (!p) return null;
              const prices = (p.product_sources ?? [])
                .map((s: any) => s.current_price)
                .filter((v: any): v is number => typeof v === "number" && v > 0);
              const lowest = prices.length ? Math.min(...prices) : null;
              const currency =
                (p.product_sources ?? []).find((s: any) => s.currency && s.currency !== "USD")?.currency ??
                p.product_sources?.[0]?.currency ??
                "BDT";
              return (
                <Link
                  key={p.id}
                  to="/app/product/$productId"
                  params={{ productId: p.id }}
                  className="glass glass-hover block rounded-3xl p-5"
                >
                  <div className="flex items-start gap-4">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-white/40">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-muted-foreground">
                          <Package className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="line-clamp-2 font-display text-sm font-semibold leading-tight">{p.name}</h2>
                      <div className="mt-2 font-display text-xl font-bold text-gradient">
                        {lowest !== null ? formatPrice(lowest, currency) : "—"}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

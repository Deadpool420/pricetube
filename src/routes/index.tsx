import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Heart, Layers, Sparkles, TrendingDown } from "lucide-react";
import { AppHeader } from "@/components/app-header";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-4 pb-24">
        {/* Hero */}
        <section className="pt-16 pb-20 md:pt-24 md:pb-28 text-center">
          <div className="glass-inset mx-auto mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-[var(--deep)]">
            <Sparkles className="h-3.5 w-3.5" />
            Liquid glass price tracking
          </div>
          <h1 className="font-display text-5xl font-bold tracking-tight md:text-7xl">
            <span className="text-gradient">Watch every price.</span>
            <br />
            <span className="text-foreground/80">Across every store.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
            Paste a product link from any site. Frost scrapes the price, compares it across sources,
            and quietly tracks every change over time.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/login"
              className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--deep)] px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-[var(--primary)]/20 transition hover:shadow-xl hover:-translate-y-0.5"
            >
              Start tracking free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </section>

        {/* Floating preview */}
        <section className="relative mx-auto max-w-4xl">
          <div className="glass-strong rounded-3xl p-6 md:p-8">
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { site: "Amazon", price: "$249.00", trend: "−12%", down: true },
                { site: "Best Buy", price: "$269.99", trend: "+2%", down: false },
                { site: "Walmart", price: "$239.50", trend: "−8%", down: true },
              ].map((s) => (
                <div
                  key={s.site}
                  className="glass-inset rounded-2xl p-5"
                >
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.site}</div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <div className="font-display text-2xl font-bold">{s.price}</div>
                    <div
                      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.down ? "bg-[oklch(0.9_0.1_160/0.5)] text-[oklch(0.4_0.13_160)]" : "bg-white/60 text-muted-foreground"
                      }`}
                    >
                      <TrendingDown className="h-3 w-3" />
                      {s.trend}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mt-24 grid gap-5 md:grid-cols-3">
          {[
            {
              icon: Layers,
              title: "Multi-source",
              body: "Add Amazon, eBay, Walmart and more for the same product. See them side by side.",
            },
            {
              icon: BarChart3,
              title: "Price history",
              body: "Every refresh adds a data point. Watch prices fall (or climb) over time.",
            },
            {
              icon: Heart,
              title: "Wishlist",
              body: "Save the products that matter. Open them in one tap when you're ready to buy.",
            },
          ].map((f) => (
            <div key={f.title} className="glass glass-hover rounded-3xl p-6">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--primary)] text-primary-foreground shadow-md">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

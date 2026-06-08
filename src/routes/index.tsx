import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Search, LineChart, Bell, Check, TrendingDown, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Price Tube — Track product prices across every store" },
      {
        name: "description",
        content:
          "Search any product by name. Price Tube finds every retailer selling it, compares prices, and quietly tracks the history for you.",
      },
      { property: "og:title", content: "Price Tube — Track product prices across every store" },
      {
        property: "og:description",
        content:
          "Search any product by name. Price Tube finds every retailer, compares prices, and tracks the history.",
      },
      { property: "og:url", content: "https://pricetube.lovable.app/" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Price Tube — Track product prices across every store" },
      {
        name: "twitter:description",
        content:
          "Search any product by name. Price Tube finds every retailer, compares prices, and tracks the history.",
      },
    ],
    links: [{ rel: "canonical", href: "https://pricetube.lovable.app/" }],
  }),
});

const EXAMPLES = [
  { name: "iPhone 15 Pro 256GB", sources: 5, price: "$1,049", drop: "$50" },
  { name: "Sony WH-1000XM5", sources: 4, price: "$329", drop: "$70" },
  { name: "Nike Air Max 90", sources: 6, price: "$108", drop: "$22" },
];

function Landing() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [q, setQ] = useState("");

  // Smart redirect: signed-in users skip the landing page.
  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/app", replace: true });
    }
  }, [user, loading, navigate]);

  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (term.length < 2) {
      navigate({ to: "/search" });
      return;
    }
    navigate({ to: "/search", search: { q: term } });
  };

  return (
    <div className="min-h-screen">
      <AppHeader />

      <main className="mx-auto max-w-5xl px-4 pb-24">
        {/* Hero */}
        <section className="pt-20 pb-16 md:pt-28 md:pb-20">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="font-display text-5xl font-bold tracking-tight md:text-6xl">
              <span className="text-foreground/80">Type the product.</span>
              <br />
              <span className="text-gradient">We find every price.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
              Search like Google. Price Tube discovers every store selling it, lines up the prices
              side by side, and quietly watches them drop.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/search"
                className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--deep)] px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-[var(--primary)]/20 transition hover:-translate-y-0.5 hover:shadow-xl"
              >
                Search prices free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <span className="text-xs text-muted-foreground">No sign-up to browse</span>
            </div>
          </div>

          {/* Real search bar — submits to /search */}
          <form onSubmit={submit} className="mx-auto mt-14 max-w-2xl">
            <div className="glass-strong rounded-3xl p-3">
              <div className="flex items-center gap-3 rounded-2xl glass-inset px-4 py-3.5">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  aria-label="Search any product"
                  placeholder="Search any product…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="submit"
                  className="ml-1 rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--deep)] px-3 py-1 text-xs font-semibold text-primary-foreground"
                >
                  Search
                </button>
              </div>
              <div className="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                Price Tube looks across Amazon, Best Buy, eBay, Walmart, Target and more
              </div>
            </div>
          </form>

          {/* Example results preview */}
          <div className="mx-auto mt-10 max-w-2xl">
            <div className="mb-3 text-center text-[11px] uppercase tracking-wide text-muted-foreground">
              Sneak peek — this is what your tracker looks like
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {EXAMPLES.map((ex) => (
                <div key={ex.name} className="glass rounded-2xl p-4 text-left">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--primary)] text-primary-foreground shadow-sm">
                    <TrendingDown className="h-4 w-4" />
                  </div>
                  <h3 className="mt-3 line-clamp-2 font-display text-sm font-semibold leading-tight">
                    {ex.name}
                  </h3>
                  <div className="mt-1 text-[11px] text-muted-foreground">{ex.sources} sources</div>
                  <div className="mt-2 font-display text-lg font-bold text-gradient">{ex.price}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-wide text-[oklch(0.4_0.13_160)]">
                    ↓ {ex.drop} this week
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-center text-[10px] text-muted-foreground">
              Example data — sign in to track your own products
            </div>
          </div>
        </section>



        {/* How it works — three numbered steps */}
        <section className="grid gap-5 md:grid-cols-3">
          {[
            {
              n: "01",
              icon: Search,
              title: "Search by name",
              body:
                "Type any product. Price Tube scans the major retailers and shows the offers in one list.",
            },
            {
              n: "02",
              icon: Check,
              title: "Pick what to track",
              body:
                "Tick the stores you actually care about. We save them as one product with multiple sources.",
            },
            {
              n: "03",
              icon: LineChart,
              title: "Watch the history",
              body:
                "Every refresh adds a point. See which store keeps dropping and which one is gouging.",
            },
          ].map((s) => (
            <div key={s.n} className="glass glass-hover rounded-3xl p-6">
              <div className="flex items-center justify-between">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--primary)] text-primary-foreground shadow-md">
                  <s.icon className="h-5 w-5" />
                </div>
                <span className="font-display text-xs font-semibold text-muted-foreground">
                  {s.n}
                </span>
              </div>
              <h2 className="mt-4 font-display text-lg font-semibold">{s.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </section>

        {/* Honest "what this is" block */}
        <section className="mt-20">
          <div className="glass-strong rounded-3xl p-8 md:p-10">
            <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="glass-inset inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-[var(--deep)]">
                  <Bell className="h-3.5 w-3.5" /> Built for one thing
                </div>
                <h2 className="mt-4 font-display text-3xl font-bold tracking-tight">
                  No tabs. No screenshots. No "wait, was it cheaper last week?"
                </h2>
                <p className="mt-3 max-w-xl text-sm text-muted-foreground md:text-base">
                  Price Tube is a single page where every product you care about sits with its current
                  prices and its history. Search, save, hit refresh, decide. That's it.
                </p>
              </div>
              <Link
                to="/search"
                className="group inline-flex items-center justify-center gap-2 self-start rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--deep)] px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-[var(--primary)]/20 transition hover:-translate-y-0.5 hover:shadow-xl md:self-auto"
              >
                Try it now
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

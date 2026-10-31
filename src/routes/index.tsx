import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Search, LineChart, Bell, Check, TrendingDown, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Price Tag — Compare phone & gadget prices in Bangladesh" },
      {
        name: "description",
        content:
          "Instantly compare verified prices in ৳ from Star Tech, Ryans, Apple Gadgets, Gadget & Gear, MobileDokan and more — with official/unofficial and RAM/storage variants side by side.",
      },
      { property: "og:title", content: "Price Tag — Compare phone & gadget prices in Bangladesh" },
      {
        property: "og:description",
        content:
          "Verified tech prices from Bangladesh stores in one place, in ৳, with variants and price history.",
      },
      { property: "og:url", content: "https://pricetagbd.lovable.app/" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Price Tag — Compare phone & gadget prices in Bangladesh" },
      {
        name: "twitter:description",
        content:
          "Verified tech prices from Bangladesh stores in one place, in ৳, with variants and price history.",
      },
    ],
    links: [{ rel: "canonical", href: "https://pricetagbd.lovable.app/" }],
  }),
});

const EXAMPLES = [
  { name: "Samsung Galaxy A56", tag: "Official · 8/256 GB" },
  { name: "CMF Phone 2 Pro", tag: "Official · 8/256 GB" },
  { name: "Redmi Turbo 4 Pro", tag: "Unofficial · 12/256 GB" },
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
              <span className="text-foreground/80">One search.</span>
              <br />
              <span className="text-gradient">Every Bangladesh store price.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
              Phones and gadgets from Star Tech, Ryans, Apple Gadgets, Gadget & Gear, MobileDokan and
              more — checked by hand, shown instantly in ৳, with official and unofficial variants kept apart.
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
                  placeholder="e.g. Galaxy A56, CMF Phone 2 Pro…"
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
                Verified listings from trusted Bangladesh retailers
              </div>
            </div>
          </form>

          {/* Example results preview */}
          <div className="mx-auto mt-10 max-w-2xl">
            <div className="mb-3 text-center text-[11px] uppercase tracking-wide text-muted-foreground">
              Try one of these
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {EXAMPLES.map((ex) => (
                <Link key={ex.name} to="/search" search={{ q: ex.name }} className="glass rounded-2xl p-4 text-left">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--primary)] text-primary-foreground shadow-sm">
                    <TrendingDown className="h-4 w-4" />
                  </div>
                  <h3 className="mt-3 line-clamp-2 font-display text-sm font-semibold leading-tight">{ex.name}</h3>
                  <div className="mt-1 text-[11px] text-muted-foreground">{ex.tag}</div>
                  <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                    Compare prices <ArrowRight className="h-3 w-3" />
                  </div>
                </Link>
              ))}
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
                "Type a phone or gadget. Results come instantly from our hand-checked catalog of Bangladesh stores.",
            },
            {
              n: "02",
              icon: Check,
              title: "Compare like for like",
              body:
                "Official vs unofficial and RAM/storage are labelled, so you never compare the wrong variant.",
            },
            {
              n: "03",
              icon: LineChart,
              title: "Save and get alerts",
              body:
                "Save a product to see its price history and get an email when it drops.",
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
                  <Bell className="h-3.5 w-3.5" /> Made for Bangladesh
                </div>
                <h2 className="mt-4 font-display text-3xl font-bold tracking-tight">
                  Stop opening ten store tabs.
                </h2>
                <p className="mt-3 max-w-xl text-sm text-muted-foreground md:text-base">
                  Every price on Price Tag comes from a real store page and is checked before it shows up.
                  No guesses, no fake deals — just the lowest in-stock price in ৳.
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

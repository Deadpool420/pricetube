import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Search, LineChart, Bell, Check } from "lucide-react";
import { AppHeader } from "@/components/app-header";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
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
              Search like Google. Frost discovers every store selling it, lines up the prices
              side by side, and quietly watches them drop.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/login"
                className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--deep)] px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-[var(--primary)]/20 transition hover:-translate-y-0.5 hover:shadow-xl"
              >
                Start tracking free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <span className="text-xs text-muted-foreground">No credit card · 30 seconds</span>
            </div>
          </div>

          {/* Search-bar mockup, not fake data */}
          <div className="mx-auto mt-14 max-w-2xl">
            <div className="glass-strong rounded-3xl p-3">
              <div className="flex items-center gap-3 rounded-2xl glass-inset px-4 py-3.5">
                <Search className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground/80">CMF Phone 2 Pro</span>
                <span className="ml-1 inline-block h-4 w-px animate-pulse bg-foreground/40" />
                <span className="ml-auto rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--deep)] px-3 py-1 text-xs font-semibold text-primary-foreground">
                  Search
                </span>
              </div>
              <div className="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                Frost looks across Amazon, Best Buy, eBay, Walmart, Target and more
              </div>
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
                "Type any product. Frost scans the major retailers and shows the offers in one list.",
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
              <h3 className="mt-4 font-display text-lg font-semibold">{s.title}</h3>
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
                  Frost is a single page where every product you care about sits with its current
                  prices and its history. Search, save, hit refresh, decide. That's it.
                </p>
              </div>
              <Link
                to="/login"
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

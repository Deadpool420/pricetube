# Cached product catalog for instant searches

The idea is right: stop paying for a live scrape every time someone searches a product that has already been searched. Two things in the suggested plan I'd change, because they don't fit how this app is built:

- **Skip the 200-product manual seed list as step one.** The cache fills itself from real searches (write-through). Seeding a hand-written list burns a lot of Firecrawl credits up front on products nobody may search, and the names rarely match retailer listings exactly. A seeding tool is still worth having — just later, and driven by what people actually search.
- **No scheduled Edge Function.** This app uses TanStack server routes; the weekly refresh will be a scheduled database job calling a public refresh endpoint.

## How it will work

```text
user searches "cmf phone 2 pro"
        |
   normalize query  ->  look up catalog
        |                    |
   fresh (< 7 days)?  yes -> return instantly (0 credits, ~50ms)
        |
        no
        |
   Firecrawl search (current pipeline)  ->  save offers to catalog  ->  return
```

## Phase 1 — Cache tables + write-through search

New tables:

- `product_catalog` — normalized search key, display name, category, image, last refreshed, active flag, search hit counter
- `catalog_sources` — one row per retailer offer: site name, url, price, currency, last checked

Access rules: anyone (signed in or not) can read the catalog, since search is public. Only the server (privileged) writes to it — no user can insert or edit cached data.

Search change in the existing search function:

1. Normalize the query (lowercase, collapse spaces, strip punctuation) and look it up.
2. Hit and fresh → return cached offers immediately, mark it as a cache hit, no Firecrawl call.
3. Miss or stale → run the current Firecrawl pipeline unchanged, then store the results.
4. The search results page gets a small "Updated X ago" line so people know how fresh prices are.

Freshness window: 7 days by default (prices on these sites don't move hourly), and a manual "Refresh prices" action on the results page for anyone who wants live numbers.

## Phase 2 — Weekly automatic refresh

A scheduled database job (Sunday night) calls a public refresh endpoint that re-runs searches for the most-searched active catalog entries, oldest first, with a hard cap per run so credit use stays predictable. Entries nobody has searched in a long time get deactivated instead of refreshed.

## Phase 3 — Admin catalog tools

You're the only user for now, so the cache still fills from your own searches — it just means the "grows automatically from traffic" effect is slower, which makes the admin seeding tool more useful, not less. An `/admin` page showing catalog size, cache hit rate, your most-searched queries and the stalest entries, plus buttons to refresh or deactivate entries and to bulk-add product names for pre-seeding a category. Access is still gated by a server-side role check on a separate roles table (not a flag on the profile) — that stays correct even if you open the app up to others later.

## Technical notes

- Tables created via migration with grants + row-level security; reads open to public, writes server-only.
- Cache read/write happens inside the existing `searchProductOffers` server function, so the frontend contract doesn't change.
- Cached offers reuse the same offer shape the UI already renders, so `src/routes/search.tsx` needs only the freshness line and refresh button.
- Refresh endpoint lives under `src/routes/api/public/` and validates its caller.
- Tracking a product still copies the offer into the user's own `products`/`product_sources` rows — the catalog is only a cache layer, user data is untouched.

## Suggested order

Phase 1 first — it alone makes repeat searches instant and cuts most credit spend. Phases 2 and 3 after you've seen real cache hits.

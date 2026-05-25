# Price Tracker — Liquid Glass

A clean iPhone-inspired liquid glass price tracking app. Users sign in, paste product URLs from multiple sources, and the app scrapes current prices, compares them across sites, and charts price history over time.

## Visual direction

- **Theme:** Arctic frost liquid glass (icy whites, frosted blues `#e8f0f8 → #2e6b8a`, deep blue accents).
- **Surfaces:** Translucent cards with `backdrop-filter: blur`, soft inner highlights, subtle noise, layered glass on a gradient mesh background.
- **Type:** SF-style (Inter Display + Inter) for an iOS feel.
- **Motion:** Gentle spring transitions, hover lift, animated price ticks.

## Pages

```text
/                       Landing — hero, glass feature cards, CTA
/login                  Email + password + Google sign-in (frosted card)
/app                    Dashboard (auth-gated): tracked products grid
/app/add                Add a product (paste URLs from multiple sites)
/app/product/$id        Product detail: price comparison + history chart
/app/wishlist           Favorites
```

## Core features (v1)

1. **Add product** — name + paste one or more URLs (Amazon, eBay, Walmart, etc.). Backend scrapes each via Firecrawl, extracts title/image/price, stores them as "sources" for that product.
2. **Price comparison** — product detail page lists every source side-by-side with current price, lowest highlighted, "Buy" link out.
3. **Price history chart** — line chart per source, daily snapshot. Manual "Refresh prices" button on v1 (no background cron yet).
4. **Wishlist** — heart toggle on any product; dedicated wishlist page.
5. **Dashboard** — grid of tracked products with current lowest price, % change indicator.

## Data model (Lovable Cloud / Supabase)

- `profiles(id, display_name, avatar_url)` — auto-created on signup.
- `products(id, user_id, name, image_url, created_at)`
- `product_sources(id, product_id, site_name, url, current_price, currency, last_checked_at)`
- `price_history(id, source_id, price, recorded_at)`
- `wishlist(user_id, product_id, created_at)` — composite PK.
- RLS: users can only see/modify their own rows. `user_roles` table reserved for future admin features.

## Technical notes

- **Auth:** Lovable Cloud, email/password + Google. Profiles table auto-created via trigger. `_authenticated` layout route guards `/app/*`.
- **Scraping:** Firecrawl connector. Server function `scrapeProductPrice(url)` uses `scrape` with JSON extraction (`{ title, price, currency, imageUrl }`). Called on add + on manual refresh.
- **Charts:** Recharts line chart styled with frosted theme.
- **Tokens:** Custom oklch palette in `src/styles.css`; glass utility classes (`.glass`, `.glass-strong`) using `backdrop-filter`.

## Out of scope for v1

- Background/scheduled price polling (manual refresh only)
- Price drop email/push alerts
- Multi-currency conversion
- Admin roles

After approval I'll enable Lovable Cloud, connect Firecrawl, create the schema, and build the UI.

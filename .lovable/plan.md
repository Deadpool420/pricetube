# Open up search, gate only on save

Currently the entire `/app/*` area (including the search-by-name flow on `/app/add`) is locked behind `src/routes/app.tsx`, which redirects unauthenticated users to `/login`. The landing page's CTAs also point straight at `/login`. I'll move the search/results experience to a public route and only prompt for login at the moment the user tries to save offers to their tracker.

## Changes

### 1. Public search route at `/search`
- Create `src/routes/search.tsx` (public, indexable) that contains the search-by-name UI currently in `src/routes/app.add.tsx` (search mode only — query input, results grid, select offers).
- Uses the existing `searchProductOffers` server function, but with the auth requirement removed (see step 4) so anonymous visitors can run searches.
- Renders `AppHeader` so anonymous users see "Sign in" in the corner.
- SEO: proper title/description/canonical, no `noindex`.

### 2. Save action prompts login
- In the new `/search` page, the "Track N offers" button:
  - If signed in → run the existing save logic (insert product + sources + history, navigate to product page).
  - If signed out → open a small modal/dialog: "Create a free account to save this product and track its price history." with a primary "Sign in / Sign up" button and a "Cancel" button. The pending selection is held in component state, and after returning from login the user lands back on `/search` with their query preserved via a `?q=` search param so they can re-select and save. (Simpler than persisting selection across redirects.)
- The Sign-in button navigates to `/login?redirect=/search?q=...` so the user comes back to the same query.

### 3. Landing page CTAs
- `src/routes/index.tsx`: change both "Start tracking free" and "Try it now" buttons from `to="/login"` to `to="/search"`. The hero search-bar mockup becomes a real input that submits to `/search?q=...`.
- Keep "Sign in" available in the header for users who want to access their saved dashboard.

### 4. Drop auth from the search server function
- `src/lib/product-search.functions.ts`: remove the `.middleware([requireSupabaseAuth])` from `searchProductOffers` so anonymous callers can search. Input validation stays (Zod, 2–200 chars). No DB writes happen in this fn, so RLS is unaffected. (`scrapeProductFromUrl` in the manual-link flow stays auth-gated since it's only reachable from the authenticated tracker page.)

### 5. Keep `/app/*` authenticated
- `src/routes/app.tsx` stays as-is: dashboard, wishlist, product detail, and the manual "paste links" add flow remain login-required (they read/write user-owned rows). The header link "Dashboard" still leads there.
- `src/routes/app.add.tsx`: the search mode is now redundant with `/search`. I'll trim that file to keep only the "Paste links" mode (still authenticated), so logged-in users can still add by URL from their dashboard. Alternatively keep both modes — leaning toward trim to avoid two copies of the same UI.

### 6. Header tweak
- `src/components/app-header.tsx`: add a "Search" link visible to everyone (signed in or out) pointing to `/search`, so anonymous visitors have an obvious entry point from any page.

## Files touched

- Create: `src/routes/search.tsx`
- Edit: `src/routes/index.tsx` (CTAs + hero search submits to `/search`)
- Edit: `src/lib/product-search.functions.ts` (remove auth middleware)
- Edit: `src/routes/app.add.tsx` (drop the duplicate search mode, keep paste-links)
- Edit: `src/components/app-header.tsx` (add public "Search" link)

## Out of scope

- No DB / schema / RLS changes.
- No changes to dashboard, wishlist, product detail, scraping, or auth provider config.
- No anonymous "save to local storage then sync on signup" — explicitly out per the request ("only prompt login when a user tries to SAVE").

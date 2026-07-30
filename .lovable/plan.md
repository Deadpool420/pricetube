Yes — both, in one pass.

## Part 1: Fix sparse search results (2–3 offers)

The search currently makes one broad Firecrawl call (limit 8) plus one backup retailer call (limit 3), then applies a hard title filter and collapses everything to one offer per scraped site name. That stack of narrowing steps is what leaves only 2–3 offers.

Changes in `src/lib/product-search.functions.ts`:

1. **More candidates, same call budget** — raise the primary search limit and the backup search limit while keeping a maximum of two Firecrawl calls per user search.
2. **Less restrictive query** — stop forcing the whole user query into an exact quoted phrase for the primary search, which currently misses many retailer product pages. Keep the Bangladesh/retailer enhancement terms.
3. **Score instead of hard-filter relevance** — replace the "title must contain a long query word or it's dropped" rule with a relevance score. Strong matches rank first; trusted retailer results are not discarded just because their scraped title is imperfect.
4. **Dedupe by hostname, not scraped site name** — scraped `siteName` values are inconsistent and currently collapse unrelated listings into one.
5. **Keep all existing quality rules** — INR/Indian retailers, classifieds, social links, and spec/review sites stay excluded; priced offers still sort ahead of unavailable ones, and trusted retailers ahead of the rest.
6. **Verify** — run real searches (for example "cmf phone 2 pro" and one more product) and confirm the results list is meaningfully longer than 2–3 offers.

Possible small supporting tweak in `src/routes/search.tsx` only if the result display needs it after verification.

## Part 2: Remove the blue bracket next to the lowest price

On the product detail page each source card draws a blue left border when it is the cheapest:

```tsx
isLowest ? "border-l-[3px] border-l-[var(--primary)]" : ""
```

Change in `src/routes/app.product.$productId.tsx`:

- Remove that conditional left border.
- Keep the "Lowest" badge and all other card styling, so the cheapest source is still clearly marked.

## Files touched

- `src/lib/product-search.functions.ts`
- `src/routes/app.product.$productId.tsx`
- `src/routes/search.tsx` (only if needed after verification)
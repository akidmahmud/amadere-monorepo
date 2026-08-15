# The N+1 Query Problem

## What it is

An N+1 problem happens when code needs data for a *list* of things, and instead
of fetching that data in one batched request, it loops over the list and
fires one separate request per item.

- 1 request to get the list (e.g. "this product has these 18 tag IDs")
- N more requests, one per item in that list (18 separate `GET /tags/:id` calls)
- Total: N+1 requests, when 2 would have done it

It's called "N+1" because the number of requests scales with the size of the
list, not with the complexity of the page. A product with 2 tags feels fine.
A product with 18 tags does 18x the round trips. This is one of the most
common real-world performance bugs — it's easy to write by accident, because
each individual request looks completely reasonable in isolation.

It shows up in two flavors:

- **Database N+1**: a loop that runs one SQL query per row instead of one
  query with a `JOIN` or `WHERE id IN (...)`.
- **HTTP/API N+1**: a loop in frontend code that fires one network request
  per item instead of one batched request. Slower in practice than the DB
  version, because each hop pays full network round-trip latency, not just
  query-planner overhead.

## The instance we found in this codebase

**File:** `apps/admin/src/components/products/ProductCategoriesTagsCard.tsx`
**Symptom:** the product edit page (`/products/:id`) felt slow to load, even
after fixing the products *list* page's over-fetching and adding a missing
database index.

### The chain of events

1. `usePickerTags()` loads tags for the picker UI via
   `GET /admin/tags?pageSize=100`. The backend hard-caps `pageSize` at 100,
   and orders results oldest-first (`orderBy: { id: 'asc' }`).
2. Once a catalog has more than 100 tags, anything past the 100th-oldest
   never appears in that picker page — **permanently**, no matter how many
   times it's refetched.
3. A product's *already-assigned* tags can themselves fall outside that
   window (a tag with a high ID, created more recently, is exactly the kind
   of tag likely to be missing). Without a fix, the edit page would silently
   show fewer selected tag chips than the product actually has.
4. The fix that got written for that bug was correct in *intent* but wrong
   in *shape*: for each tag ID missing from the picker's 100, fire a
   separate `GET /admin/tags/:id` request and resolve it individually.

```ts
// Before — one HTTP request per missing tag
Promise.all(
  missing.map((id) => proxyFetch<AdminTagDto>(`/admin/tags/${id}`).catch(() => null)),
).then((results) => { /* ... */ });
```

For a product with 18 tags outside the picker's first page, this produced
**18 sequential-ish network requests** just to resolve tag *names*, on top
of every other request the edit page already needed (product detail,
categories, brands, product picker, cross-sell, frequently-bought-together,
attributes...). That N+1 chain was the single biggest remaining chunk of the
page's load time — bigger than the database query cost it was sitting next to.

### How it was found

Not by guessing — by opening the real edit page in a browser and reading the
network request log. The 18 near-identical requests
(`/admin/tags/581`, `/admin/tags/582`, `/admin/tags/583`, ...) were
immediately visible once we actually looked, in a way that reading the
source code alone didn't make obvious. **This is the general lesson: when a
page feels slow, check the network tab before changing any code.** A dozen
small requests can easily cost more than one moderately expensive one.

### The fix

Replace N individual lookups with one batched lookup, using the IDs you
already have.

**Backend** (`apps/backend/src/modules/tags/tags.service.ts`,
`admin-tags.controller.ts`, `dto/admin-tag-query.dto.ts`): added an optional
`ids` query param to the existing tags list endpoint. When present, it skips
pagination entirely and returns exactly the requested rows:

```ts
async adminList(page: number, pageSize: number, q?: string, ids?: string) {
  if (ids?.trim()) {
    const parsedIds = ids.split(',').map(Number).filter(Number.isInteger);
    const items = await this.prisma.client.tag.findMany({
      where: { deletedAt: null, id: { in: parsedIds } },
      include: WITH_TRANSLATIONS,
    });
    return toPaginatedResult(items.map(toAdminTagDto), items.length, 1, items.length || 1);
  }
  // ...existing paginated/search path unchanged
}
```

**Frontend**: one request instead of a loop.

```ts
// After — one HTTP request for all missing tags
proxyFetch<Paginated<AdminTagDto>>(`/admin/tags?ids=${missing.join(",")}`)
  .then((res) => { /* ... */ });
```

Verified live: 18 requests → 1 request, same tag chips rendered, no
behavior change from the user's point of view — just far fewer round trips.

## How to recognize this pattern yourself

Ask these questions whenever you see a `.map()` (or a loop) around a fetch
call, in either frontend or backend code:

1. **Is this fetch inside a loop over a list of IDs?** That's the shape to
   be suspicious of.
2. **Does the batch size scale with user data**, not a fixed small constant?
   Looping over "the 3 payment methods" is fine. Looping over "however many
   tags this product has" is not — that number is unbounded.
3. **Is there already an endpoint that returns a list filtered by IDs**
   (`WHERE id IN (...)`), or would one need to be added? Almost every
   resource that has a "get one by ID" endpoint can get an "get many by IDs"
   variant cheaply — it's usually the same query with `id: { in: ids } }`
   instead of `id: id`.
4. **When debugging "this page feels slow," check the Network tab first.**
   Sort by count or look for many requests to near-identical URLs
   (`/tags/581`, `/tags/582`, ...). That pattern is the signature of an N+1
   bug and is usually more impactful to fix than tuning a single slow query.

## Related fixes from the same investigation (for context)

This N+1 bug was found *after* two other, different performance problems on
the same page were already fixed — worth knowing they're separate issues
that can all show up on one slow page at once:

- **Over-fetching**: the products list query was reusing the same "load
  everything" Prisma `include` built for the single-product edit page (every
  FAQ, every variant's full attribute-value chain, etc.) even though the
  list table only renders a handful of fields. Fixed with a dedicated, lean
  query for the list endpoint.
- **Missing index**: `ProductVariant.productId` had no database index at
  all, so every "load a product with its variants" query forced a
  sequential scan of the variants table.

Query-shape fixes, indexes, and N+1 fixes are three different categories of
performance bug. They often hide behind the same symptom ("this page is
slow") and are easy to conflate, but the diagnosis — and the fix — for each
is different.

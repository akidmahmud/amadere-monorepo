# SDD ledger — plan: docs/superpowers/plans/2026-09-25-multi-store-pos.md

Setup: not a git repo; user owns git → no worktree, no commits. Ledger lives here.
Pre-flight: Task 4 consumes StockService.move (T2) — match. Task 5/6/7/8 consume StoresService.scope + requireOneStore (T3) — match. T8 imports PosStoreQueryDto → Ruling: put it in stores/dto/store-query.dto.ts (plan note) so stock doesn't import pos.
Ruling: VAT added on top (POS_VAT_ADDED_ON_TOP = true) — user didn't answer; follows mockup — cost if wrong: flip one constant.
Task 1: Ruling: `prisma migrate dev` unusable (shadow replay of 20260807103916_promo_videos_standalone fails on FK) → migration generated with `migrate diff --from-config-datasource`, then stripped 7 pre-existing drift statements (customer_campaign FKs/defaults, stock_alerts/wholesale_orders indexes) that would have dropped hand-made indexes — cost if wrong: none for POS; drift remains the user's to resolve.
Task 1: Ruling: AdminUser has firstName/lastName (no `name`) → stores list selects those.
Task 1: Ruling: bugfix-log entries batched per group of tasks (one numbered item per task) instead of one append per task — same content, fewer writes.
Task 1: Ruling: CASH/CARD added to admin label maps + PaymentProviderType, NOT to PAYMENT_PROVIDER_TYPES (New Order dropdown) — phone orders aren't counter-paid.
Task 1: complete (tests: prisma validate ✓, migrate deploy ✓, backend tsc ✓, admin tsc ✓)
Task 2: complete (tests: jest stock.service.spec → 6/6; real-DB SQL check of upsert/conditional update in rolled-back txn ✓)
Task 3: Ruling: PosStoreQueryDto lives as StoreQueryDto in stores/dto/store.dto.ts (shared by pos + stock).
Task 3: complete (tests: jest stores → 4/4 scope tests; tsc ✓)
Task 4: Ruling: posStoreId treats undefined like null (`== null`) — older specs build orders without storeId; real rows always have null.
Task 4: complete (tests: jest orders+payments → 54/54, incl. 3 new pos-store tests; tsc ✓)
Task 5: Ruling: added pos-catalog.service.spec (plan had manual-only) pinning shared+own-store visibility and variant mapping. Variant label from attributeValue.translations[EN].value (AttributeValue has no `value`). Categories filtered PUBLISHED/not deleted. list() got a `take` param (stats use 10k).
Task 5: complete (tests: jest pos-catalog → 2/2; tsc ✓; live curl deferred to Task 17 boot)
Task 6: Ruling: coupon discount follows AdminOrderCreationService.resolveCartDiscount (max of COUPON/UPSELL), AppliedDiscount uses `source` not `type`. Added a discount-spread test.
Task 6: complete (tests: jest pos-sale → 9/9; tsc ✓)
Task 7: complete (tests: jest stock-docs → 4/4 + generateBarcodes; tsc ✓)
Task 8: complete (tests: jest transfers → 7/7; tsc ✓)
Task 9: Ruling: added assertBarcode(code) (tested) instead of inline check in products.service; wired in Task 11. generateBarcodes got a test (plan had none).
Task 9: complete (tests: jest barcode.util → 5/5, stock suite 23/23)
Task 10: Ruling: sales report excludes CANCELED as well as RETURNED from gross; stock report adds barcode column.
Task 10: complete (tests: jest pos-reports → 3/3; tsc ✓; `nest start` boots, 32 /admin/{pos,stock,stores} routes mapped — no DI errors)
Task 11: Ruling: applyStoreOnlyRules also forbids a non-all-stores user from turning a store product back into a shared one (spec silent; sharing affects every store). CSV import keeps an existing store product's status. AdminProductDto exposes storeId + barcode; admin schema.d.ts regenerated via `npm run typegen` (grew 27,426→28,596 lines, includes earlier unsynced endpoints). Store field = new ProductStoreField.tsx; status select limited to ADMIN_ONLY while a store is chosen.
Task 11: complete (tests: jest store-only 6/6, products suite 36/36; backend + admin tsc ✓)
Task 12: Ruling: login `next` guard extracted as safeNext() in lib/pos-host.ts (tested) instead of inline. clearAuthCookies now expires with same domain/path (a bare delete would miss the parent-domain cookie). ADMIN_COOKIE_DOMAIN documented in apps/admin/.env.example.
Task 12: complete (tests: node --test pos-host 3/3; admin tsc ✓)
Task 13: Ruling: added POS-scoped customer search + find-or-create (/admin/pos/customers) — cashiers lack customer.view. Added POST /admin/pos/quote (price() extracted from create(), same maths) so the till shows exact VAT/discount instead of an estimate; coupon is server-checked on Apply. PosContext provides store selection to all /pos pages; waits for the store list before rendering (live run showed store-less 400s otherwise). Scanner ref updated in effect; store switch resets cart during render (React lint rules).
Task 13: complete (tests: node --test pos-cart 4/4, pos-sale 12/12; admin tsc ✓; screenshot matches mockup layout)
Task 14: Ruling: no supplier picker on stock-in (Accounts parties need Accounts permission) — note field instead. Transfers list attaches product names (tested).
Task 14: complete (transfers 8/8; admin tsc ✓)
Task 15: complete (jsbarcode added; admin build ✓)
Task 16: Ruling: CashAccount.storeId not set from the Stores page (informational only per spec).
Task 16: complete (admin build ✓, 8 new routes)
Task 17: Ruling: DIGITAL products excluded from the POS catalog (live screenshot showed ebooks at the counter) — tested.
Task 17: fixed sales report dropping stores whose only activity was a return (live CSV check) — pos-reports "returns only" RED→GREEN.
Task 17: backend `npm test` 691/700 — 9 failures all in net-profit/accounts/vat/vat.service.spec.ts, pre-existing (service changed 2026-08-28, spec 2026-08-23, not touched). Backend lint: prod code clean; new specs carry the same no-unsafe-* errors as existing specs (35 in orders specs). Admin: npm test 29/29, tsc ✓, next build ✓.
Task 17: live E2E (local dev, super admin): 37/37 checks — stock-in, quote=sale total, cash change, oversell refused, store isolation of recent sales, return restock + refund, transfer state machine incl. partial receive, adjust reasons, movement ledger, store-only product ADMIN_ONLY + hidden from other stores + storefront 404, barcode generate, CSV. Ledger: SALE IN 1495 / REFUND OUT 1495. Test data removed; product 80 sellable back to 22.
Task 17: complete
Final review: fresh reviewer (opus subagent) — 2 Critical, 6 Important, 17 Minor.
Final: fixed transfer dispatch/receive/cancel/approve race — claim-first conditional updateMany; "concurrent clicks" tests RED→GREEN, transfers 10/10.
Final: fixed store staff never seeing Dispatch/Receive (storeId undefined for non-all-stores) — canActFor() + store?.id; tests/pos-transfer.test.mjs RED→GREEN; buttons disabled while busy.
Final: fixed open redirect in safeNext ("/\evil.com", raw tab) — URL-origin check; pos-host test RED→GREEN.
Final: fixed logout leaving pre-domain host-only cookies — hostOnlyExpiry()/expireHostOnlyCookies on login/2fa/refresh (auth-proxy) and logout; cookie-expiry test RED→GREEN.
Final: fixed API-only discountAmount (cashier could zero a sale) — field removed, coupons only; pos-sale test RED→GREEN.
Final: fixed variant/product mismatch — StockService.move validates variant belongs to product and presence matches hasVariants; POS sale only takes catalog-visible products and refuses ৳0 prices; tests RED→GREEN.
Final: Ruling: #7 hand-written indexes — `migrate diff` after deploy was checked and does NOT propose dropping them; added a schema WARNING comment rather than restructuring — cost if wrong: a future generated migration could drop the index and stock-in to non-online stores would fail loudly.
Final: Ruling: #8 VAT-on-top — unchanged, escalated to the user for sign-off before go-live — cost if wrong: customers overcharged 15% on VAT-able items.
Final: Ruling: held-basket deletion (reviewer Minor) re-graded Important (silent loss of a parked customer basket) — fixed by clearing heldSaleId on cart clear; UI-only, no component test harness in admin, verified by reasoning + tsc/lint.
Final: Ruling: other /api/backend proxy routes that refresh tokens don't append host-only expiry — a leftover host-only token still works and is cleared at the next login/logout — cost if wrong: one-time forced logout doesn't happen; users keep sessions until then.
Final: minor (deferred): return races (two concurrent returns can double restock/refund; updateStatus race pre-existing).
Final: minor (deferred): heldSale re-hold of a resumed basket leaves a duplicate; resume doesn't restore customer; replaces current cart silently.
Final: minor (deferred): "today"/report ranges use server-local midnight (UTC host → 00:00–06:00 Dhaka sales land on previous day).
Final: minor (deferred): qty input backspaced to empty removes the line.
Final: minor (deferred): transfer approval not store-scoped (approver at store A can approve B→C).
Final: minor (deferred): Store.isActive not enforced server-side.
Final: minor (deferred): sales report attributes returns to the sale date, not the return date.
Final: minor (deferred): CSV formula-injection not neutralised in toCsv.
Final: minor (deferred): GET /admin/stores exposes staff emails to every pos.access user.
Final: minor (deferred): duplicating a store-only product yields a shared DRAFT (bypasses store rule, no storefront leak).
Final: minor (deferred): catalog editors without pos.* get 403 editing a store product (form always sends storeId).
Final: minor (deferred): lookup falls back to first fuzzy match on a partial code.
Final: minor (deferred): receipt shows neither cash tendered nor change (not stored).
Final: minor (deferred): Order Manager COMPLETED→PROCESSING→COMPLETED double-decrement (pre-existing) now also hits store stock.
Final: minor (deferred): stock-in/adjust/transfer accept another store's store-only product.
Final verification: backend npm test 701/710 (9 = pre-existing vat.service.spec failures), tsc ✓; admin npm test 34/34, tsc ✓, lint ✓ (1 pre-existing warning); live E2E re-run 0 FAIL; test data removed (p80 sellable 22, 0 movements, only pre-existing POS order 6760 remains).
Ruling: ledger kept in docs/superpowers/plans (repo keeps *-progress.md files there) instead of deleting a workspace.
Phase 1.1: plan docs/superpowers/plans/2026-09-25-pos-phase-1-1.md approved; Native execution.
P1.1 Task 1: complete (pos-settings 3/3, pos-sale 21/21 incl. VAT off/included/5%/exempt; taxAmount now stored whenever VAT applies, incl. inclusive mode).
P1.1 Task 2: complete (migration 20260926090000_pos_phase_1_1 hand-trimmed of the known drift; backfills returned_at for existing RETURNED orders).
P1.1 Task 3: complete (pos-invoice 6/6 via npm test — isomorphic-dompurify's deps need --experimental-vm-modules, so plain npx jest can't load it).
P1.1 Task 4: complete (node --test pos-invoice 6/6; receipt renders via template; settings page VAT + Invoices; sale get() now returns variantLabel; tenderedAmount stored — Task 5 item 4 done early).
P1.1 Ruling: receipt VAT label uses today's POS setting (rate/mode not stored per sale) — amounts are the stored ones; cost if wrong: a reprint after a VAT change shows the new label.
P1.1 Task 5: complete — dhakaRange (3 tests); returns claim-first + returnedAt + status event emitted (listeners: customer stats, profit, SMS) — POS no longer depends on OrdersService (removed); Order Manager sets returnedAt; stock state after completion now read from status history (stockIsOut) — fixes both re-complete double decrement AND the Cancel→Processing→Cancel double restock; inactive stores blocked (sale, stock-in, adjust, transfer create both sides, receive); approval scoped; toCsv formula-safe + header-only with columns; store list staffCount + staff only for stores.manage/all_stores; duplicate keeps storeId/ADMIN_ONLY; lookup exact; move refuses another store's store-only product. Backend npm test 739/748 (9 = pre-existing vat.service.spec).
P1.1 Ruling: sales report gross now = all non-cancelled sales made in range (incl. later-returned), returns by returnedAt; net = gross − returns — previously returned sales were excluded from gross AND counted as returns on the sale day.
P1.1 Ruling: an older orders spec ("detoured through CANCELED") got a history mock matching its own described scenario — the status label alone is ambiguous for PROCESSING.
P1.1 Task 6: complete — parseQtyInput + QtyInput (local text); held baskets keep customer, re-hold replaces, resume confirms; product form sends storeId only when changed + server lets non-POS editors edit a store product without moving it (test); stores page uses staffCount.
P1.1 Task 7: complete — profit/salesLines/customers (3 tests), header-only CSV via columns, readable SHEET_HEADERS (test); Reports page: Store profit tab + Sales sheet / Customer sheet buttons.
P1.1 Task 8: complete — defaultCostCentre (test) + ExpenseForm pre-selects the user's store cost centre (initial fill + both resets).
P1.1 Ruling: E2E found the invoice sanitiser (DOMPurify/HTML parser) foster-parents {{row}} tags placed between <tr>s out of the table — fixed with protectRowTags/restoreRowTags (tests); also added {{refRow}} (built-in template had lost the "Ref:" label).
P1.1 Task 9: backend npm test 746/755 (9 = pre-existing vat.service.spec), admin 43/43, tsc both clean, lint clean on touched prod files; Playwright E2E 40/40 (VAT off / 5% included, template save strips script and receipt uses store template with variant + cash/change, concurrent return → 1 success, profit tab + both .xlsx sheets, inactive store refused); test data cleaned (incl. pos.vat row, which did not exist before).
P1.1 Final review: fresh reviewer (opus) — 0 Critical, 6 Important, ~17 Minor.
P1.1 Final: fixed Order Manager/POS return race — updateStatus now locks the order row and re-reads it inside the tx; no-op if already in target status — "locks the order and re-reads it" RED→GREEN.
P1.1 Final: fixed inclusive-VAT vs Order Manager — updateAmounts refuses POS orders (RED→GREEN); order invoice + custom invoice template use orderTaxView() (tests/order-tax, 3 tests) and label it "VAT included".
P1.1 Final: fixed Accounts VAT return ignoring POS VAT — website estimate excludes channel POS, POS adds its recorded taxAmount (vat.service.pos.spec 2 tests RED→GREEN).
P1.1 Final: fixed undone returns still counted — returnedAt cleared when leaving RETURNED/PARTIALLY_RETURNED; returns queries also filter status (2 tests RED→GREEN).
P1.1 Final: fixed qty box — no remount (focus kept), "0" snaps back (parseQtyInput test updated RED→GREEN); E2E step "clear and type a new number".
P1.1 Final: fixed stranded transfers — create refuses store-only products; DISPATCHED→CANCELLED allowed and returns stock to source; store-only guard skips SALE/RETURN (3 tests RED→GREEN).
P1.1 Final: Ruling: Phase-1 rule "goods in transit can't be cancelled" replaced — the reviewer showed it strands stock — cost if wrong: a sender can cancel after goods physically left (the UI offers it only to the sending store).
P1.1 Final: Ruling: re-graded Minor→Important and fixed — receipt VAT label shows 0% when POS VAT is off; a cart emptied line by line releases the resumed held basket.
P1.1 Final verification: backend 755/764 (9 = pre-existing vat.service.spec), admin 46/46, tsc clean both, lint clean on touched prod files; Playwright E2E 41/41; data cleaned to baseline.
P1.1 minor (deferred): per-product mixed VAT rates make the single-rate VAT label approximate (till + receipt).
P1.1 minor (deferred): {{tags}} inside href/src could become javascript: from a customer's name (needs a template author to do it + a click).
P1.1 minor (deferred): template <style> is page-wide and may load external url()/@import.
P1.1 minor (deferred): invoice editor for a store without its own template previews the built-in, not the Default it actually prints.
P1.1 minor (deferred): "unsafe parts were removed" toast may fire on harmless templates (DOMPurify reserialises).
P1.1 minor (deferred): {{tag}} inside <caption> or an attribute within a table is moved by protectRowTags (layout only).
P1.1 minor (deferred): tenderedAmount has no upper bound (absurd input → 500).
P1.1 minor (deferred): returnSale refunds after commit — a refund failure leaves RETURNED without refund/event.
P1.1 minor (deferred): migration backfill of returned_at covers RETURNED only and uses updated_at.
P1.1 minor (deferred): exact lookup searches within the first 200 "contains" hits; SKU compare is case-sensitive.
P1.1 minor (deferred): store switcher still lists inactive stores (the server refuses them).
P1.1 minor (deferred): no hint in Store profit when a store has no cost centre.
P1.1 minor (deferred): a pos.store_products user can reassign another store's product to their own store (possibly pre-existing).

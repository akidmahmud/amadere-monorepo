# Landing page with a real checkout

How to publish a hand-designed HTML page that takes real orders — the same
validation, COD OTP, fraud check and order pipeline as `/checkout`.

Working example: **`/fiber-mix-demo`**
(source: `packages/db/scripts/data/demo_landing.html`).

---

## 1. What you get

| | |
| --- | --- |
| Your HTML and CSS | rendered exactly as designed |
| Search engines | **can** index the page (text is in the served HTML) |
| Product image | the product's own image, or a pack-specific one if assigned |
| Pack / size picker | prices, sale prices and stock read **live from the product** |
| Quantity | updates the real cart |
| Bill | real subtotal, real shipping fee for the chosen district, real total |
| Order form | the real checkout form — same fields, same validation |
| Confirm | creates a real order, COD OTP included if you have it enabled |

---

## 2. Before you start: the product must exist

The block does **not** hold prices. It reads them from a product, so a price
you change in **Products** updates every landing page using it.

1. **Products → Add product**
2. Add each size as a **variant** (e.g. `500 গ্রাম` ৳790, `১ কেজি` ৳1,580).
   The variant's attribute values become the pack labels on the card.
3. Set stock. An out-of-stock variant appears **disabled** with `স্টকে নেই`.
4. **Publish** it.
5. Copy its **slug** — the `/products/<slug>` part of its URL.

> Nothing below works until this exists. If the slug is wrong the card shows
> *Product "…" not found*.

---

## 3. Prepare your HTML

### 3.1 Delete your static order card

Remove the whole mock: pack radios, quantity buttons, bill rows, name/phone/
address inputs, and the submit button. All of it is provided by the block.

### 3.2 Put the placeholder where the card should appear

```html
<div data-amader-block="CheckoutProductCard"
     data-product-slug="amader-fiber-mix"></div>
```

That single empty `<div>` is the whole integration. Keep your own section
wrapper, heading and background around it:

```html
<section class="band band--dark" id="order">
  <div class="wrap">
    <h2 class="head-title">অর্ডার করুন</h2>

    <div data-amader-block="CheckoutProductCard"
         data-product-slug="amader-fiber-mix"
         data-cta-label="অর্ডার কনফার্ম করুন"
         data-whatsapp-number="8801615980395"></div>
  </div>
</section>
```

### 3.3 Attributes

| Attribute | Required | Effect |
| --- | --- | --- |
| `data-amader-block="CheckoutProductCard"` | **yes** | tells the page to put the checkout card here |
| `data-product-slug` | **yes** | which product to sell |
| `data-cta-label` | no | confirm button text (default: the standard order button) |
| `data-show-image` | no | `no` hides the product image. Shown by default |
| `data-heading` | no | heading drawn *by the card* (usually leave off — use your own) |
| `data-subheading` | no | sub-heading drawn by the card |
| `data-whatsapp-number` | no | adds a WhatsApp button. Digits only, with country code |

Any `data-*` becomes a setting: `data-cta-label` → `ctaLabel`.

### 3.4 What is removed from your HTML

The page is sanitised before rendering. **Stripped:**

- `<script>` blocks
- inline handlers — `onclick`, `onchange`, `onsubmit`, …
- `<!DOCTYPE>`, `<html>`, `<head>`, `<body>`, `<title>`, `<meta>`

**Kept:** all your markup, classes, `<style>`, `<svg>`, `<img>`, `<details>`,
`<a href>`, `data-*` attributes, and Google Fonts `<link>` tags.

So build without JavaScript:

| Instead of | Use |
| --- | --- |
| `<button onclick="jump('order')">` | `<a href="#order">` |
| JS accordion | `<details>` / `<summary>` |
| JS scroll reveal | show the content by default |
| JS quantity / price maths | the block does it |

---

## 4. Publish the page

1. **Pages → Add page**
2. **Title** and **Slug** (the slug is the URL: `/fiber-mix`)
3. Click **Create & open builder** — do *not* open the classic HTML editor
4. In the left palette, **Content → HTML page**. Drag it onto the canvas.
5. Select the block. In the right panel:

   | Field | Set to |
   | --- | --- |
   | **html** | paste your whole HTML document |
   | **mode** | **Indexable (recommended)** |
   | **fullBleed** | **Full screen** for a landing page |
   | **minHeight** | any — it is only a floor before the real height is measured |

6. Click **Publish EN** (top right).
7. Repeat for **BN** if you want a Bangla version — switch the locale with the
   EN / BN toggle, then Publish BN.

> **mode must be Indexable.** *Sandboxed* renders inside an iframe: your own
> scripts would run, but search engines cannot index it **and the checkout
> block cannot be embedded**.

---

## 5. Check it worked

Open `/your-slug` and confirm:

- [ ] the product image appears at the top of the card
- [ ] prices on the card match **Products** (not numbers from your HTML)
- [ ] clicking a pack updates **সাব-টোটাল** and **সর্বমোট**
- [ ] `+` / `−` change the quantity and the bill
- [ ] choosing a **জেলা** changes the delivery charge
- [ ] the site header and footer are gone (if Full screen)
- [ ] placing a test order produces an order number

---

## 6. Alternative: no HTML at all

You do not need a pasted page. In the builder, open the **Checkout** group and
drag **Product order card** straight onto the canvas. You then pick the product
from a searchable list instead of typing a slug.

Use the HTML route when you have a design; use this when you just want the card.

---

## 7. How customers reach the page

### Inside the page — works now

Anchor links. Your pricing buttons already do this:

```html
<a class="plan-pick" href="#order">এইটা নিন</a>
...
<section id="order"> … the placeholder … </section>
```

### From a product card — **not possible yet**

Product cards everywhere on the site (carousels, search, related, cross-sell)
link to `/products/<slug>`. That is hardcoded, and a product has no field for a
custom landing URL.

To send customers to a landing page today:

- link it from a **banner**, **menu item**, or **blog post**
- use it as the destination of a **Facebook / Google ad**

To make product cards point at it, one of these has to be built:

| Option | Work | Effect |
| --- | --- | --- |
| Add a "Landing page URL" field to the product | small | that product's cards link to your landing page; everything else unchanged |
| Make the landing page replace the product page | large | `/products/<slug>` *is* the landing page; affects SEO and every existing link |

Neither is built. Ask if you want one.

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| *Product "…" not found* | wrong slug, or product unpublished | check the slug in **Products** |
| *Choose a product for this order card* | `data-product-slug` missing | add it |
| Grey box saying `CheckoutProductCard` | placeholder is inside a **Sandboxed** block | set **mode → Indexable** |
| One pack greyed out | that variant is out of stock | restock, or ignore — it is correct |
| Prices are not what your HTML says | correct — they come from the product | edit the product, not the HTML |
| Bill shows ৳0 | nothing picked yet | pick a pack; the bill fills in |
| Site header still visible | **fullBleed** not set | set **Full screen**, republish |
| Buttons / accordions dead | your `<script>` was stripped | use `<a href="#…">` and `<details>` |
| Card text hard to read | your section sets a light `color` | the card forces its own; if it persists, report it |
| Page 500s right after publishing | API restarting | wait ~30s and reload |

---

## 9. Known limits

- **The card brings its own styling.** Your `.pick` / `.bill` / `.field` CSS
  does not reach it. Making the block emit *your* class names, so your
  stylesheet drives it, is possible but not built.
- **Your page's JavaScript never runs** in Indexable mode. This is the price of
  being indexable.
- **Adds to the cart, does not replace it.** If a visitor already had items,
  they are included — which is why the bill shows the whole cart total, not
  just the pack on screen.
- **`CheckoutCustomerNote` and `CheckoutCrossSell`** are declared but not
  implemented; they render a grey placeholder if used.

---

## 10. Editing and removing

- **Change the page:** Pages → the row → **Builder** → edit → **Publish**.
- **Change prices:** edit the product. The page follows; no republish needed.
- **Take it down:** Pages → the row → set status to Draft, or delete it.
- **Rebuild the demo:**
  ```
  pnpm --filter @amader/db exec tsx scripts/seed-demo-landing.ts
  pnpm --filter @amader/db exec tsx scripts/seed-demo-landing.ts --clear
  ```

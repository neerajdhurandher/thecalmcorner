# The Calm Corner — E-commerce Technical Design

> *A little green. A little glow. A lot of calm.*

| | |
|---|---|
| **Status** | Draft v2 (single-app architecture) |
| **Business** | Premium lifestyle e-commerce (live plants, artificial plants, candles, curated combos) |
| **Market** | India (Bengaluru base) |
| **Audience of this doc** | Founders, designers, engineers |

---

## 1. Goals & Scope

### 1.1 Business goals
- Launch a premium, minimalist online store for India within ~13 weeks (MVP), then iterate.
- Convert mobile-first traffic (Instagram `@thecalmcorner.life` is the main acquisition channel).
- Make catalog, stock, orders and content easy for a non-technical team to manage.
- Keep running costs low at launch and scale cleanly with growth.

### 1.2 Non-goals (for MVP)
- Multi-vendor marketplace, native mobile apps, international shipping, subscriptions.
  (The design leaves room for all of these later.)

### 1.3 Build vs. buy decision
| Option | Pros | Cons |
|---|---|---|
| **Shopify** | Fastest launch, hosted, apps for everything | Theme-limited "distinctive" brand feel, transaction fees + app costs, weaker India-specific control (GST invoices, COD rules) |
| **Custom from scratch** | Total control | Slow, high risk (cart, tax, payments, admin all reinvented) |
| **Separate apps: headless commerce engine (Medusa) + Next.js storefront** | Ready-made commerce modules (cart, orders, inventory, promotions) | Two apps to build, deploy, version and monitor; extra hosting cost and ops overhead for a small team |
| **Single app: Next.js + Payload CMS 3 on PostgreSQL (recommended)** | One codebase, one deploy, one admin for products, orders and content; fully custom premium UI; own your data; no GMV fees | Commerce logic (cart, checkout, stock, GST) is our own code; storefront and admin scale together |

**Recommendation:** **One Next.js application with Payload CMS 3 embedded.** Payload installs inside the Next.js project and provides the admin panel (`/admin`), authentication, access control, media library, REST/GraphQL APIs, a Local API, background jobs and database migrations. The storefront, admin, APIs and webhooks therefore ship as **one deployable app** backed by **one PostgreSQL database**.

This is the simplest setup to maintain for a small team: one repo, one build, one container, one set of environment variables and one place to look when something breaks. The trade-off is that core commerce flows are implemented in-house (Section 6). Payload's official ecommerce plugin can be evaluated as a starting point for products, carts and orders, but must be checked against our GST, COD and live-plant requirements before adoption.

> **Why SQL (PostgreSQL) and not NoSQL?** Orders, payments, stock, GST invoices and refunds are relational and need strict transactions, constraints and reporting. Postgres covers this natively, and JSON columns handle the flexible product attributes (plant care, scent notes). Payload's Postgres adapter (built on Drizzle ORM) generates versioned migrations from the collection config, so schema changes stay reviewable and repeatable.

> **When to split later:** if traffic, team size or release cadence grows enough that the admin/back office needs to scale or deploy independently, the commerce code in `src/commerce/` can be extracted into a separate service without changing the database.

> If the team has no engineering capacity at all, launch on Shopify first and migrate later. Everything in this doc about data model and content still applies.

---

## 2. Brand → Product Requirements

| Brand trait | Technical implication |
|---|---|
| Editorial warm minimalism | Use the supplied ivory/olive/sandstone palette, generous negative space, natural-light photography and restrained ornamentation rather than generic retail UI. |
| Botanical and tactile | Use Playfair Display + Manrope, soft botanical accents, ceramic/linen-inspired surfaces, modest rounded corners and diffused shadows. |
| Thoughtfully curated | Organize the store around The Green Edit, The Glow Edit and The Calm Duo; surface rituals, scent profiles and room vignettes as editorial content. |
| Trustworthy, locally rooted | Show Bengaluru studio roots, live-plant transit terms, verified reviews, transparent delivery estimates, product care and shipping details. |
| Gifting audience | Make Calm Duo pairing, handwritten seed-paper note, gift packaging and personalization part of the product and checkout journey. |

---

## 3. Functional Requirements

### 3.1 Customer-facing (storefront)
- **Browse:** Home, category pages (Live Plants, Artificial Plants, Candles, Combos), collections, search with filters (light needs, pet-safe, size, scent, burn time, price, room).
- **Product detail:** Multi-angle gallery with zoom, handcrafted/local-transit/pure-soy badges, planter-finish and scent selectors with live price updates, Bengaluru/PAN-India PIN check, care/ingredients/shipping accordions, reviews and a sticky add-to-bag action.
- **Ritual pairing:** Pre-curated Calm Duos and a product-page bundle builder for a plant, brass mister and wick trimmer with visible bundle savings.
- **Cart & checkout:** Guest + account checkout, pincode serviceability check, address book, coupons, gift options, COD (with limits) & prepaid, order summary with GST.
- **Gifting:** Optional ₹150 handwritten seed-paper note and gift box; collect recipient name and a message of up to 200 characters.
- **Account:** OTP/email login, orders, tracking, addresses, wishlist, reorder.
- **Content:** Plant care guides, journal/blog, FAQs, policies, About.
- **Marketing:** Newsletter signup, WhatsApp opt-in, Instagram feed embed, abandoned-cart emails, referral/coupon codes.
- **Trust:** Verified reviews with photo testimonials, 14-day live-plant replacement guarantee, clear care/returns policies and a WhatsApp concierge for repotting or bulk-gift enquiries.

### 3.2 Admin / operations
- Product, variant, collection, price, media management.
- Inventory per location (Bengaluru nursery/warehouse), low-stock alerts.
- Order management: confirm, pack, ship (label generation), cancel, refund, replacement.
- Customer view, coupon & promotion management.
- CMS for homepage banners, journal posts, announcement bar.
- Reports: sales, AOV, top products, stock, coupon performance, shipping/RTO.
- Roles: Owner, Manager, Fulfilment, Support, Content editor.

### 3.3 India-specific
- **Payments:** UPI, cards, netbanking, wallets, COD, EMI (Razorpay).
- **GST:** HSN codes per product, CGST/SGST (intra-state, Karnataka) vs IGST (inter-state), GST-compliant invoice PDF. Prices are GST-inclusive on storefront.
- **Shipping:** Pincode serviceability + rates + AWB + tracking via aggregator (Shiprocket / Delhivery / Shipway).
- **Live-plant logistics:** Verify PIN serviceability; offer climate-cushioned same/next-day direct delivery for eligible Bengaluru PIN codes, with a 14-day replacement guarantee. Artificial plants and soy candles are eligible for PAN-India courier shipping with protective packaging.
- **Notifications:** SMS/WhatsApp (DLT-registered templates for SMS), email.
- **Legal pages:** Privacy (DPDP Act 2023), Terms, Shipping, Refund/Returns, Contact, Grievance officer.

---

## 4. System Architecture

```
   Customer (mobile/web)          Ops / content team
            │                            │
            ▼                            ▼
   ┌──────────────────────────────────────────────┐
   │        CDN / Edge / WAF (Cloudflare)         │
   └──────────────────────┬───────────────────────┘
                          ▼
 ┌────────────────────────────────────────────────────────┐
 │        THE CALM CORNER APP  (one Next.js app)          │
 │                                                        │
 │  Storefront pages      Payload Admin       API routes  │
 │  /, /collections,      /admin              /api/*      │
 │  /products, /cart,     (products, orders,  (Payload    │
 │  /checkout, /account   content, users)      REST +     │
 │                                             commerce)  │
 │  ───────────────────────────────────────────────────── │
 │  src/commerce: cart · checkout · stock · GST · COD     │
 │  Webhooks: /api/hooks/razorpay, /api/hooks/shiprocket  │
 │  Payload Jobs queue (emails, invoices, reminders)      │
 └───────┬───────────────────┬──────────────────┬─────────┘
         ▼                   ▼                  ▼
 ┌───────────────┐  ┌────────────────┐  ┌─────────────────┐
 │ PostgreSQL 16 │  │ Object storage │  │ Razorpay        │
 │ (all data +   │  │ S3 / R2 + CDN  │  │ Shiprocket      │
 │  job queue +  │  │ (product media,│  │ MSG91/WhatsApp  │
 │  search)      │  │  invoices)     │  │ Resend/SES      │
 └───────────────┘  └────────────────┘  └─────────────────┘
```

There is **one application and one database**. Storefront pages call commerce code directly through Payload's **Local API** (in-process function calls, no HTTP hop), so there is no separate backend to version, deploy or keep in sync. Redis, a separate search server and a separate CMS are **not required at launch**.

### 4.1 Components
| Layer | Choice | Why |
|---|---|---|
| App framework | **Next.js (App Router) + TypeScript** | Storefront, admin and APIs in one project; SSR/ISR for SEO and speed |
| Styling / UI | **Tailwind CSS** + Radix UI / shadcn-ui primitives + brand design system | Accessible, fully restyleable |
| Admin, CMS & data layer | **Payload CMS 3** (embedded in Next.js) | Admin UI, auth, roles, media, content, REST/GraphQL/Local API, hooks, jobs, migrations |
| Commerce logic | **Custom module** in `src/commerce/` (optionally seeded from Payload's ecommerce plugin) | Cart, checkout, stock, GST, COD, bundles shaped to our India-specific rules |
| Database | **PostgreSQL 16** via `@payloadcms/db-postgres` (Drizzle ORM) | Relational integrity and transactions for orders/stock; versioned migrations |
| Background jobs | **Payload Jobs Queue** (stored in Postgres) + scheduled tasks | Emails, invoices, abandoned cart, reconciliation; no Redis needed |
| Search | **Postgres full-text search** (`tsvector` + `pg_trgm`) at launch; Meilisearch/Algolia later if needed | One fewer service to run; enough for a curated catalog |
| Media | Payload uploads → S3/Cloudflare R2 storage adapter + `next/image` (AVIF/WebP) | Image-heavy brand |
| Payments | **Razorpay** (primary), COD handled in-app | UPI/cards/COD/EMI, India-first |
| Shipping | **Shiprocket** (aggregator) | Multi-courier, COD remittance, tracking |
| Email | Resend or AWS SES (Payload email adapter) | Transactional + marketing flows |
| SMS/WhatsApp | MSG91 / Gupshup / WhatsApp Cloud API | OTP, order updates |
| Analytics | GA4 + Meta Pixel/CAPI + PostHog (or Plausible) | Attribution from Instagram ads |
| Monitoring | Sentry, Better Stack/Grafana, UptimeRobot | Errors, logs, uptime |

### 4.2 Project layout (single app)
```
thecalmcorner/
├─ src/
│  ├─ app/
│  │  ├─ (storefront)/         # Customer pages: home, collections, products, cart, checkout, account
│  │  ├─ (payload)/            # Payload admin (/admin) and Payload API (/api) routes
│  │  └─ api/hooks/            # Razorpay & Shiprocket webhook route handlers
│  ├─ collections/             # Payload collections (Products, Variants, Orders, Customers, Pages...)
│  ├─ globals/                 # Header, footer, announcement bar, store settings
│  ├─ commerce/                # Cart, checkout, pricing, stock, GST, COD, bundles, shipping
│  ├─ integrations/            # Razorpay, Shiprocket, MSG91, WhatsApp, email clients
│  ├─ jobs/                    # Payload job tasks & schedules
│  ├─ components/              # Design-system & storefront components
│  ├─ styles/                  # Tailwind theme with brand tokens
│  ├─ access/                  # Role-based access control functions
│  ├─ migrations/              # Generated Payload/Drizzle migrations (committed)
│  └─ payload.config.ts
├─ tests/                      # Unit, integration, e2e (Playwright)
├─ docs/                       # This document, ADRs, runbooks
├─ Dockerfile                  # One image for the whole app
├─ docker-compose.yml          # Local Postgres + Mailpit
└─ .github/workflows/          # CI/CD
```
Tooling: **pnpm**, a single `package.json`; no monorepo or Turborepo needed.

---

## 5. Frontend Design

The supplied Stitch screens and style guide are the implementation reference for the storefront's visual direction and composition:

- [Approved product brief](../the_calm_corner_prd_brief.md)
- [Home screen](../stitch_the_calm_corner_store/the_calm_corner_home/screen.png) and [HTML reference](../stitch_the_calm_corner_store/the_calm_corner_home/code.html)
- [Shop catalog screen](../stitch_the_calm_corner_store/the_calm_corner_shop_catalog/screen.png) and [HTML reference](../stitch_the_calm_corner_store/the_calm_corner_shop_catalog/code.html)
- [Product detail screen](../stitch_the_calm_corner_store/the_calm_corner_product_detail/screen.png) and [HTML reference](../stitch_the_calm_corner_store/the_calm_corner_product_detail/code.html)
- [Our Story screen](../stitch_the_calm_corner_store/the_calm_corner_our_story/screen.png) and [HTML reference](../stitch_the_calm_corner_store/the_calm_corner_our_story/code.html)
- [Serene Botanical Sanctuary design system](../stitch_the_calm_corner_store/serene_botanical_sanctuary/DESIGN.md)

Treat the HTML as design reference/prototype, not production-ready code: reimplement its visual system using accessible, responsive components and real product/CMS data. Replace placeholder image sources and demo contact details before launch.

### 5.1 Information architecture
```
/                      Home
/collections/all       All products
/collections/green-edit       Live and artificial botanicals
/collections/glow-edit        Soy candles
/collections/calm-duos        Plant, candle and accessory bundles
/collections/[handle]  Other curated collections (e.g., gifting, room vignettes)
/products/[handle]     Product detail
/journal, /journal/[slug]  Care guides & stories
/cart  /checkout  /order/[id]/confirmation
/pages/about           Our Story
/account, /account/orders, /account/addresses, /account/wishlist
/contact  /faq  /shipping  /returns  /privacy  /terms
/search?q=
```

### 5.2 Design system
- **Color tokens:** warm ivory `#FCFAEB` (base), ivory `#F8F5ED` / soft sandstone `#E8DDCC` (surfaces), deep olive `#313D25` (primary interaction), olive `#48543A` (brand accent), sage `#A3AE91`, warm taupe `#B8A58D`, charcoal `#292920`. Use the source design tokens in the linked style guide as the canonical values.
- **Typography:** Playfair Display for editorial display/headings; Manrope for body, navigation, labels and product data. Hero: 56/64px desktop and 38/46px mobile; headline-lg: 40/48px desktop and 28/36px mobile. Use tracked uppercase Manrope for eyebrows.
- **Spacing & grid:** fluid 12-column desktop (≥1024px), 8-column tablet (768–1023px), 4-column mobile (<768px); desktop 48px outer margin, tablet 32px, mobile 20px; gutters 24px desktop / 16px mobile. Preserve generous vertical section spacing.
- **Shape & depth:** default 8px corner radius; pill buttons/chips and circular icon medallions; use gentle arch crops only for editorial imagery. Prefer warm tonal surfaces and hairline taupe borders over strong shadows; use a soft ambient shadow for floating/sticky elements.
- **Components:** 48px minimum-height primary buttons, deep olive fill with ivory text; outlined secondary buttons; warm-ivory inputs with taupe borders and olive focus ring; product photography in 4:5 cards.
- **Motion:** subtle transitions only, respecting `prefers-reduced-motion`.
- **Tokens** live in `src/styles` (Tailwind theme), documented in Storybook and checked against the supplied Stitch references.
- **Accessibility:** WCAG 2.1 AA, keyboard-operable filters/selectors, visible focus, meaningful image alt text from CMS, contrast checks and reduced-motion support.

### 5.3 Rendering strategy
| Page | Strategy |
|---|---|
| Home, journal, collections | ISR; revalidated by Payload `afterChange` hooks when content/catalog changes (in-process, no webhook) |
| Product, category | ISR + on-demand revalidation; live price/stock fetched on request |
| Cart, checkout, account | Dynamic, server-rendered with auth cookie; mutations via Server Actions |
| Search | Server-rendered results from Postgres full-text search |

### 5.4 State & data
- React Server Components read data through Payload's **Local API** (direct, typed function calls; no network hop).
- Mutations (add to bag, apply coupon, update address) use **Server Actions** that call `src/commerce`; TanStack Query only where client-side refresh is needed (e.g., PIN check, mini-cart).
- Cart ID stored in an httpOnly cookie (guest carts persist for 30 days).
- Types generated by Payload (`payload-types.ts`) are shared by pages, admin and commerce code, with no separate API client to maintain.
- Forms: React Hook Form + Zod.

### 5.5 Performance & SEO budgets
- Meet the brief's targets: LCP < 2.0s on 4G, CLS < 0.05; also target INP < 200ms.
- `next/image`, AVIF/WebP, responsive sizes, blur placeholders, lazy-loaded below-fold.
- Self-hosted fonts with `font-display: swap`; minimal third-party scripts (load after interaction).
- SEO: semantic HTML, `Product`/`Offer`/`BreadcrumbList` JSON-LD, sitemap, canonical URLs, OpenGraph images, clean slugs and content targeting “indoor plants online Bengaluru”, “scented soy candles India” and “housewarming plant combos”.

### 5.6 Key UX flows
- **Global shell:** Editorial announcement bar, brand mark, category navigation (Home, Shop All, The Green Edit, The Glow Edit, The Calm Duo, Our Story), currency/search/account/wishlist/cart utilities, and a distinct plant-delivery notice. Keep WhatsApp concierge accessible but unobtrusive.
- **Home:** Sunlit editorial hero with two CTAs; four curated category cards; brand philosophy; featured botanicals and soy lights; Calm Duo builder; scent profiles; room-vignette inspiration; Instagram gallery; newsletter; editorial footer.
- **Catalog:** Curated title/intro and collection tabs; desktop faceted sidebar for fulfillment/city, plant care/sunlight, aroma notes, vessel/planter finish and price; active-filter chips, sort and responsive three-column product grid with pagination.
- **PDP:** Multi-angle gallery and zoom; product badges; finish/scent selectors that update price; PIN delivery checker; ₹150 gift ritual toggle with recipient/message fields; instant buy (UPI/card), sticky add-to-bag, accordions and paired-item bundle builder with savings.
- **Our Story:** Founding story rooted in Bengaluru, paired “Why Plants?” / “Why Candles?” pillars, sustainable craft and packaging, community/UGC gallery, and collection CTA.
- **Checkout:** Keep the existing secure checkout flow; retain gift recipient/message data and gift add-on as explicit line-item/order data. Show the selected delivery promise and product-specific eligibility.
- **Post-purchase:** Order confirmation, WhatsApp/email updates, plant-care tips email series after delivery.

### 5.7 Screen-specific responsive behavior
- Keep the desktop catalog filter sidebar and three-column grid; on tablet/mobile convert filters to an accessible drawer or sheet with active selections and an obvious apply/clear action.
- Reflow hero, philosophy, bundle builder and story compositions into a single-column mobile sequence without hiding their primary CTA.
- On mobile PDP, keep the purchase action available in a sticky bottom bar while ensuring it does not obscure selectors, delivery information or keyboard focus.
- Use responsive 4:5 product imagery and reserve image dimensions to prevent layout shift; maintain readable line lengths and touch targets of at least 44px.

---

## 6. Backend Design (inside the same app)

### 6.1 Approach
There is no separate backend service. Server-side logic lives in the same Next.js app in three layers:

1. **Payload collections**: the data model plus admin screens, access control, validation and lifecycle hooks (`beforeChange`, `afterChange`).
2. **`src/commerce/` domain services**: plain TypeScript functions that implement commerce rules and run inside Postgres transactions. Storefront pages, Server Actions, webhooks and jobs all call these services.
3. **Payload Jobs**: background and scheduled work, queued in Postgres.

| Commerce service (`src/commerce/`) | Responsibility |
|---|---|
| `cart` | Create/merge carts, add/update/remove lines, apply coupons, gift add-on (₹150 note + recipient/message) |
| `pricing` | Variant/finish/scent pricing, compare-at prices, bundle savings, GST-inclusive totals |
| `inventory` | Atomic stock reservation, release on expiry/cancel, decrement on fulfilment, low-stock alerts |
| `checkout` | Validate cart, delivery eligibility, payment method rules; create order inside a transaction |
| `payments/razorpay` | Create Razorpay order, verify signature, capture, refund, webhook handling |
| `payments/cod` | COD rules (pincode, amount cap, non-live-plant items only), OTP confirmation |
| `shipping/shiprocket` | Serviceability, rates, create shipment, AWB, label, tracking webhooks |
| `delivery-rules` | Bengaluru (560xxx) same/next-day live-plant delivery vs PAN-India courier eligibility |
| `tax` | HSN → GST rate, CGST/SGST vs IGST split, FY-sequenced invoice numbers |
| `invoice` | GST invoice PDF generation, stored in object storage |
| `bundles` | Calm Duo definitions; bundle price and availability derived from component stock |
| `reviews` | Verified-purchase reviews with photos and moderation |
| `claims` | 14-day live-plant replacement claims |
| `notifications` | Email/SMS/WhatsApp templates and dispatch |
| `search` | Maintain Postgres full-text search vectors for products |

### 6.2 API surface
- **Storefront:** no public API is required for our own pages; they use the Local API and Server Actions. Minimal route handlers (`/api/cart`, `/api/pincode`) are exposed only where client components need them.
- **Admin:** Payload Admin at `/admin` (session auth, RBAC via collection access functions), plus custom admin views for fulfilment and reports.
- **Payload REST/GraphQL (`/api/*`):** auto-generated and locked down by access control; useful for future mobile apps or integrations.
- **Webhooks (inbound):** `/api/hooks/razorpay`, `/api/hooks/shiprocket` (signature-verified, idempotent, logged to `webhook-events`).
- **Domain events:** Payload `afterChange` hooks on Orders/Shipments queue jobs (`send-order-confirmation`, `generate-invoice`, `sync-search`, `track-analytics`), so slow work never blocks the request.

### 6.3 Core flows

**Checkout & payment (prepaid)**
1. The customer builds a bag (Server Actions → `commerce/cart`), enters a PIN code, and `delivery-rules` + Shiprocket return eligible options and rates.
2. `commerce/checkout` validates the cart, **reserves stock in a DB transaction**, creates a `pending_payment` order and a Razorpay order.
3. The customer pays in the Razorpay modal, and the browser posts `payment_id`/`signature` to a Server Action.
4. The server verifies the signature and marks the order `paid`/`placed`.
5. The Razorpay `payment.captured` webhook is the source of truth: it reconciles orders whose browser closed before step 4. A scheduled job releases reservations for unpaid orders after 30 minutes.
6. The order's `afterChange` hook queues jobs for the confirmation email/WhatsApp, GST invoice and analytics.

**Fulfilment**
In `/admin`, staff mark an order "Ready to ship". A job creates the Shiprocket shipment and stores the AWB and label. Tracking webhooks then update its status (picked up → in transit → out for delivery → delivered / RTO). COD remittance is reconciled against Shiprocket reports by a scheduled job.

**Returns / replacement (live plants)**
Customer submits a claim with photos within the published 14-day guarantee window → staff review it in `/admin` against the policy → replacement order or refund (Razorpay refund API / store credit).

### 6.4 Cross-cutting concerns
- **Transactions:** checkout, stock changes and refunds run inside a single Postgres transaction (Payload `req.transactionID` / Drizzle transaction).
- **Inventory:** conditional atomic updates (`UPDATE … SET available = available - :qty WHERE id = :id AND available >= :qty`) prevent overselling; bundles reserve each component SKU.
- **Idempotency:** unique constraints on `razorpay_payment_id` and `(provider, event_id)`; webhook handlers return early when an event was already processed.
- **Validation:** Payload field validation + Zod at Server Action/route boundaries.
- **Background jobs:** Payload Jobs Queue (abandoned cart, review requests, stale COD confirmation, reservation expiry, search refresh, report snapshots, reconciliation). Jobs run on the same long-running app process (`autoRun` schedule); a second instance of the **same image** can be started in worker mode if job volume grows.
- **Caching:** Next.js data cache + CDN; `revalidateTag` from Payload hooks. Add Redis only if measured load requires it.
- **Config:** 12-factor, env-driven, secrets in a secret manager.
- **Rate limiting & bot protection:** Cloudflare WAF + app-level rate limits on login/OTP/coupon/PIN endpoints; Turnstile on forms.

---

## 7. Database Design

PostgreSQL is the single system of record for catalog, orders, customers, content and the job queue. Tables are generated from **Payload collection configs** via the Postgres adapter (Drizzle ORM); schema changes are made in code and shipped as committed migrations (`payload migrate:create` → `payload migrate`).

### 7.1 Core entities (Payload collections, simplified)
```
products ─< variants >─ stock_levels (location)        products >─< collections / categories
variants ─ prices (INR, compare_at)                     products ─ plant_care | candle_spec (fields/groups)
carts ─< cart_lines                                     orders ─< order_lines
orders ─< payments ─< refunds                           orders ─< shipments ─< tracking_events
orders ─ invoice                                        customers ─< addresses
coupons ─< coupon_rules                                 bundles ─< bundle_items >─ variants
reviews >─ products / customers / orders                plant_claims >─ orders
pages · journal_posts · care_guides · media             users (admin staff, roles)
```

### 7.2 Key collections & fields
| Collection | Key fields | Constraints / notes |
|---|---|---|
| `products` | title, slug, type (`live_plant` / `artificial_plant` / `candle` / `bundle`), description (rich text), media[], badges[], hsn_code, shipping_class, status, SEO | Unique `slug`; soft delete; full-text `search_vector` |
| `variants` | product, sku, options (size, planter finish, scent), price_paise, compare_at_paise, weight_g, dimensions | Unique `sku`; price ≥ 0 |
| `stock_levels` | variant, location, on_hand, reserved, available, low_stock_threshold | `available ≥ 0` check; unique `(variant, location)` |
| `plant_care` (group on product) | light, water, difficulty, pet_safe, air_purifying, care_guide | Enum selects |
| `candle_spec` (group on product) | wax_type, scent_top/heart/base, burn_hours, weight_g, vessel | — |
| `bundles` / `bundle_items` | product, discount_type, discount_value; variant, quantity | Unique `(bundle, variant)` |
| `carts` / `cart_lines` | customer?, session token, pincode, coupon, gift (enabled, recipient, message ≤ 200), expires_at | Guest carts expire after 30 days |
| `orders` / `order_lines` | order_no, customer, email/phone, addresses, status, payment_method, totals (subtotal, discount, shipping, gift, CGST/SGST/IGST, total, paise), gift data, UTM | Unique `order_no`; never hard-deleted |
| `payments` / `refunds` | order, provider, razorpay_order_id, razorpay_payment_id, amount, status | Unique `razorpay_payment_id` |
| `shipments` | order, courier, awb, label_url, status, eta | Unique `awb` |
| `invoices` | order, invoice_no (FY-sequenced), issued_at, pdf, tax breakup | Unique `order`, unique `invoice_no` |
| `hsn_codes` | code, description, gst_rate | — |
| `pincode_serviceability` | pincode, city, state, cod_allowed, live_plant_ok, eta_min/max | Unique `pincode` (CHAR 6) |
| `coupons` | code, type, value, min_order, usage_limit, per_customer_limit, valid_from/to | Unique `code` |
| `reviews` | product, customer, order, rating 1–5, title, body, photos, status | Moderation via admin |
| `plant_claims` | order, line, reason, photos, status, resolution | Within 14-day window |
| `webhook_events` | provider, event_id, type, payload (JSON), processed_at | Unique `(provider, event_id)` |
| `customers` | name, email, phone, consent flags, addresses | Payload auth collection (OTP/email) |
| `users` | name, email, role (owner, manager, fulfilment, support, content) | Payload auth collection with 2FA |
| Content | `pages`, `journal_posts`, `care_guides`, `media`; globals `header`, `footer`, `announcement_bar`, `store_settings` | Drafts, versions and scheduled publish |

Constraints that Payload field config can't express (check constraints, partial indexes, GIN/trigram indexes) are added as **custom SQL inside the generated migration files**, so they stay versioned with the rest of the schema.

### 7.3 Data guidelines
- Money stored as integer minor units (paise); currency `INR`.
- Index: slug/handle, SKU, FKs, `orders.created_at`, `orders.status`, `pincode`, GIN on `search_vector`, trigram index on product title.
- Soft-delete (`deleted_at`) for catalog entities; orders are never hard-deleted.
- **PII** (name, phone, address) encrypted at rest (disk/volume encryption; column-level for sensitive fields); retention policy per DPDP Act.
- **Backups:** automated daily snapshots + PITR (WAL) with 14–30 day retention; monthly restore drill.
- **Migrations:** generated by Payload, reviewed in PR, committed under `src/migrations/`, run automatically in CI/CD before the new app version receives traffic. Use expand → migrate → contract for breaking changes so the previous version keeps working during rollout and rollback.

---

## 8. Third-party Integrations

| Concern | Provider | Notes |
|---|---|---|
| Payments | Razorpay | Test/Live keys per env, webhook secret, auto-capture, refunds via API |
| Shipping | Shiprocket | API token, pickup location, webhooks for tracking |
| Email | Resend / SES | SPF/DKIM/DMARC configured on domain |
| SMS/OTP | MSG91 | DLT registration required (entity, header, templates) |
| WhatsApp | WhatsApp Cloud API / Gupshup | Template approval; order updates + abandoned cart |
| Search | Postgres full-text search (built-in) | Upgrade to Meilisearch/Algolia only if catalog/search needs outgrow it |
| CMS | Payload (built into the app) | No separate CMS service; content edits revalidate pages via hooks |
| Analytics/Ads | GA4, Meta Pixel + Conversions API, Google Ads | Server-side events for iOS accuracy |
| Reviews | Native (Payload collection) | Avoids per-seat SaaS cost; revisit later |

---

## 9. Security & Compliance

- **Transport:** HTTPS everywhere, HSTS, TLS 1.2+.
- **Payments:** Card data never touches our servers (Razorpay hosted checkout → PCI-DSS SAQ-A).
- **AuthN/Z:** Customers: email/phone OTP (+ optional Google). Admin: strong passwords + 2FA, RBAC, session expiry, IP allowlist optional. Short-lived JWTs, httpOnly secure cookies, CSRF protection.
- **Input & output:** Validate everything, parameterised queries (ORM), sanitise rich text, strict CSP, secure headers.
- **Secrets:** Never in repo; use secret manager (AWS SSM/Secrets Manager or Doppler); rotate on staff change. Secret scanning in CI.
- **Infra:** Private DB subnets, least-privilege IAM, WAF, DDoS protection (Cloudflare), automatic OS/dependency patching (Dependabot/Renovate).
- **Auditability:** Admin action audit log; webhook event log.
- **Compliance:** DPDP Act 2023 (consent, data access/deletion requests, grievance officer), Consumer Protection (E-Commerce) Rules 2020 (seller details, return policy, grievance mechanism), GST registration and invoicing, Legal Metrology declarations on packaged goods (candles: net qty, MRP, manufacturer/importer details). Confirm exact obligations with a CA/lawyer.
- **Fraud/COD risk:** OTP/WhatsApp confirmation for COD, order value caps for new customers, pincode RTO scoring, velocity checks.

---

## 10. Environments, Deployment & CI/CD

### 10.1 Environments
| Env | Purpose | Data |
|---|---|---|
| `local` | `pnpm dev` + Docker Compose (Postgres, Mailpit) | Seed data |
| `preview` | Optional per-PR app deploy with its own throwaway database (e.g., Neon branch) | Synthetic |
| `staging` | Production-like, mock payment provider (then the chosen gateway's test mode), courier sandbox | Anonymised/synthetic |
| `production` | Live | Real |

### 10.2 Hosting (phased; launch provider not yet chosen, see 10.5)
The whole store is **one Docker image** (Next.js `standalone` output) plus **one managed Postgres**. Host it on a long-running Node server rather than pure serverless, so Payload jobs, webhooks, PDF generation and DB connections behave predictably.

**Phase 1 — Lean launch (≈ ₹4–12k/month infra):**
- App: **Railway / Render / Fly.io** (Mumbai/Singapore region) or a single AWS Lightsail/EC2 instance with Docker. Run 1–2 instances behind the platform load balancer.
- DB: managed Postgres (Neon / Supabase / RDS) in India with PITR.
- Media: Cloudflare R2 or S3 + CDN. Domain/DNS/WAF/caching: Cloudflare.
- No Redis, search server or separate CMS to run.

**Phase 2 — Scale (AWS `ap-south-1` Mumbai):**
- Same image on **ECS Fargate** behind ALB, autoscaling on CPU/RPS. Optionally run a second ECS service from the **same image** in job-worker mode.
- **RDS PostgreSQL** Multi-AZ, read replica for reporting; add ElastiCache Redis only if caching/rate limiting needs it.
- S3 + CloudFront; Secrets Manager; CloudWatch + Sentry.
- IaC with **Terraform**; rolling or blue/green deployments.

> Keep the app and DB in India (Mumbai/Hyderabad) for latency and data-residency comfort.
> Vercel can host the app too, but background jobs would then need Vercel Cron plus short-running tasks; prefer a container host for simplicity.

### 10.3 CI/CD (GitHub Actions)
```
PR opened  → install (pnpm, cached) → lint → typecheck → unit & integration tests
           → check migrations are generated & committed → next build
           → e2e (Playwright vs. app + Postgres service container)
merge main → build & push ONE Docker image → run `payload migrate` (staging)
           → deploy staging → smoke tests → manual approval
           → run `payload migrate` (prod) → deploy prod (rolling) → smoke test → notify
rollback   → redeploy previous image tag; migrations are backward compatible
```
- Branching: trunk-based with short-lived feature branches, protected `main`, required reviews & green checks.
- Conventional Commits + semantic release tags; changelog automated.
- One pipeline, one artifact, one version number for the whole store.

### 10.4 Release safety
- Feature flags (e.g., PostHog/Unleash) for risky features.
- Zero-downtime deploys; health checks (`/health`, `/ready`).
- Rollback = redeploy previous image (< 5 min); DB changes follow expand/contract.
- Avoid deploys during peak campaign windows (festivals, Instagram launches).

### 10.5 Low-budget hosting options (decision pending)
Hosting is **not decided yet**. The app is built as one Docker image plus one Postgres database, so any of these work without code changes. Prices are indicative (checked Nov 2026); verify before choosing.

| Option | What runs where | Approx. cost/month | Setup & upkeep effort | Notes |
|---|---|---|---|---|
| **A. Railway (suggested for launch)** | App + Postgres in one project, auto-deploy on `git push` | ~$5–15 (usage-based) | **Lowest**: no servers, built-in Postgres, logs and env vars | Nearest region is Singapore; turn on DB backups; no permanent free tier (trial credit only) |
| **B. Render** | Web service + managed Postgres | ~$13+ (web $7 + DB $6) | Low: Git-based deploys, managed DB | Free web services sleep and free Postgres expires after 30 days, so use free only for testing |
| **C. Vercel Pro + Neon Postgres** | App on Vercel (Payload's official template), DB on Neon | ~$20 + Neon (free tier possible at start) | Low: zero server management | Vercel **Hobby (free) is non-commercial only**, so the store needs Pro; background jobs must run via Vercel Cron within function time limits |
| **D. Own VPS + Coolify** | App + Postgres on one VPS in India (AWS Lightsail Mumbai / DigitalOcean Bangalore) managed by Coolify (free, self-hosted PaaS) | ~$6–12 | **Highest**: you own OS updates, backups, monitoring | Cheapest at scale and in-India data residency; best only if someone is comfortable with basic server admin |

**Free add-ons that fit any option:** Cloudflare (DNS, CDN, SSL, WAF), Cloudflare R2 for product images (10 GB free, no egress fees), GitHub Actions for CI, Sentry free tier for errors, and UptimeRobot free tier for uptime checks.

**Development/staging for free:** Neon free Postgres + Render free web service (sleeps when idle) or a local Docker setup is enough until launch.

**Suggestion:** start with **Option A (Railway)** for the least work, or **Option D** if the lowest monthly bill and in-India hosting matter more than setup effort. Both can later move to AWS Mumbai (Section 10.2, Phase 2) by redeploying the same image.

---

## 11. Testing Strategy

| Level | Tooling | Focus |
|---|---|---|
| Unit | Vitest / Jest | Pricing, GST calc, combo logic, delivery rules |
| Integration | Vitest + test Postgres (Testcontainers / CI service) via Payload Local API | Checkout transactions, payment webhook idempotency, stock reservation, migrations apply cleanly |
| E2E | Playwright | Browse → add to cart → checkout (Razorpay test) → order; admin fulfilment; mobile viewport |
| Contract | Zod schemas + generated Payload types | Server Action / webhook payload compatibility |
| Visual | Storybook + Chromatic (optional) | Design-system regressions |
| Performance | Lighthouse CI, k6 | Core Web Vitals budgets; load test checkout for expected peak ×3 |
| Security | `npm audit`/Snyk, OWASP ZAP baseline, secret scanning | Pre-launch pen-test checklist |
| UAT | Manual with ops team on staging | Order → ship → deliver → refund drills |

---

## 12. Observability & Maintenance

### 12.1 Monitoring
- **Errors:** Sentry (browser + server, one project), alert to Slack/WhatsApp.
- **Logs:** Structured JSON → Better Stack / Loki / CloudWatch; request IDs on every request and job.
- **Metrics/APM:** p95 latency, error rate, job queue depth/failures, DB connections, payment success rate.
- **Uptime:** synthetic checks on home, PDP, cart, checkout API every minute.
- **Business alerts:** payment failure spike, webhook failures, order stuck in `pending`, stock-out of top SKUs, RTO rate.

### 12.2 Operational runbook (day-to-day)
| Cadence | Task | Owner |
|---|---|---|
| Daily | Review new orders, process fulfilment, check failed payments/webhooks, answer support | Ops |
| Daily | Check dashboard alerts | Engineer on call (lightweight) |
| Weekly | Update stock & new arrivals, review low stock, moderate reviews, publish journal/Instagram-aligned content | Ops / Content |
| Weekly | Review analytics (conversion, AOV, funnel drop-off), coupons | Founder / Marketing |
| Monthly | Dependency updates, security patches, restore-from-backup test, cost review | Engineer |
| Monthly | GST reconciliation (GSTR-1/3B), payout & COD remittance reconciliation | Finance |
| Quarterly | Vulnerability scan, load test before festive season, DR review, UX review | Team |

### 12.3 Content & catalog management (non-technical)
- **Everything in one admin (`/admin`):** products, variants, stock, orders, fulfilment, coupons, reviews, claims, homepage, banners, journal and care guides. Content changes go live via revalidation hooks; no deploy needed.
- **Drafts & scheduling:** Payload drafts/versions for pages and products; preview before publish.
- **Bulk import:** CSV import for products and stock; image naming convention `sku_01.jpg`.
- **Photography standards:** consistent background/lighting, 4:5 primary ratio, min 2000px long edge, alt text mandatory.

### 12.4 Reliability targets
| Metric | Target |
|---|---|
| Availability | 99.9% monthly (storefront and admin share the app) |
| RPO / RTO | ≤ 15 min / ≤ 2 hours |
| Checkout p95 API latency | < 800 ms |
| Incident response | Sev1 ack < 30 min |

Disaster recovery: PITR restore of DB, redeploy the app image from the registry, IaC rebuild of infra, media in versioned bucket.

---

## 13. Analytics & Growth

- Event schema: `view_item`, `add_to_cart`, `begin_checkout`, `add_payment_info`, `purchase` (GA4 + Meta CAPI + server-side).
- UTM capture and storage on order for channel attribution (Instagram, Google, referral).
- Email/WhatsApp lifecycle flows: welcome (first-order coupon), abandoned cart, post-purchase care tips, review request (D+7), re-order reminders (candles ≈ 30–45 days), plant "care check-in".
- A/B testing via feature flags for hero, PDP layout, free-shipping threshold.
- SEO content strategy: plant care guides ("low-light plants for Bengaluru apartments"), gifting guides, candle scent guides.

---

## 14. Delivery Plan & Timeline

The phases below are listed in implementation order. Work can overlap across phases only after its prerequisites and acceptance gate are met. The 13-week estimate assumes a small team and timely decisions, product data and vendor access; deferred decisions (payment gateway, hosting, GST) can move the launch date if not made in time.

### Current MVP decisions (24 Nov 2026)
These decisions take precedence over earlier sections of this document wherever they conflict.

| Area | Decision for now | Deferred / later |
|---|---|---|
| GST & invoices | Out of current scope: no GST calculation, HSN setup or GST invoice generation. Store prices as final selling prices (paise). | Add the `tax` and `invoice` services later; confirm obligations with a CA before taking live orders. |
| Payments | **Online payment only. COD is disabled.** Build checkout up to a provider-agnostic `PaymentProvider` interface, with a mock provider for development and tests. | Choose the gateway (e.g., Razorpay or Paytm) later and implement only that adapter. A real gateway is required before real orders can be taken. |
| Inventory & coupons | **First-priority MVP feature.** Admin pages (Payload `/admin`) to add, edit and manage products, variants, stock levels and coupons, plus a coupon service that validates codes and calculates discounts. Specified in Phase 0; built right after the app scaffold, in Phase 2. | Advanced promotions and stock reports later. |
| Live-plant delivery | A separate, admin-managed **serviceable PIN code list**, starting with **Bengaluru only**. Live plants can be ordered only for PINs in this list. | Add more cities by adding PIN codes in `/admin`; no code change needed. |
| Artificial plants & candles | Deliver **PAN India** (any valid 6-digit Indian PIN code). | Exclude non-serviceable PINs once a courier partner is chosen. |
| Design & logo | **Stitch designs and logo are final**; implement them as-is (see Section 5). | — |
| Hosting | **Not decided.** Build the app so it runs locally and in Docker; see the low-budget options in Section 10.5. | Pick a provider before staging/production setup. |

### Phase 0 — Discovery & decisions (Weeks 1–2)
1. Confirm MVP scope, single Next.js + Payload architecture, and whether to adopt or build on Payload's ecommerce plugin. Time-box the plugin evaluation against cart, checkout, inventory, coupon and delivery-rule requirements.
2. Confirm fulfilment rules: inventory location(s), PAN-India delivery for artificial plants and candles, mixed-cart handling (a cart containing live plants for a non-listed PIN is blocked with a clear message), delivery promises, packaging and returns/replacement rules.
3. Confirm commercial rules: online payment only (COD disabled), coupon types and limits, gift add-on, bundle pricing, shipping charges and free-shipping threshold.
4. Specify the inventory admin and coupon service, the first features to build:
   - **Products:** add, edit, publish/unpublish and archive; required fields; variants; media; care/scent attributes; SEO.
   - **Stock:** quantity per variant, adjustment reasons, low-stock threshold.
   - **Coupons:** percent/fixed discount, minimum order, validity dates, usage and per-customer limits, eligible products/collections, activate/deactivate.
   - **Staff roles:** who can do each of the above.
5. Prepare the initial Bengaluru serviceable PIN code list for live plants (PIN, area name, delivery ETA).
6. Finalize the MVP SKU/catalog spreadsheet (SKU, product type, variants, price/MRP, stock, shipping class, care/scent attributes, images and alt text).
7. Export final assets from Stitch: logo files, page designs, colours, typography and spacing tokens. Design and logo are approved, so there is no redesign step.
8. Shortlist email/WhatsApp vendors and courier options. Payment gateway, hosting and GST are deferred (see Current MVP decisions).
9. Obtain legal review of store policies (privacy, terms, shipping, returns/replacement, contact/grievance).

**Exit gate:** business rules, admin/coupon specification, catalog sheet, PIN code list and final design assets are ready; each deferred decision (payment gateway, hosting, GST) has an owner and a target decision date.

### Phase 1 — App and delivery foundations (Weeks 2–4)
1. Create the single Next.js + Payload project, TypeScript conventions, linting/formatting and local environment.
2. Add Docker Compose for local PostgreSQL and Mailpit; provide seed data and a documented setup command.
3. Configure Payload with the PostgreSQL adapter, admin route, media storage adapter and generated TypeScript types.
4. Create the initial collections/globals and access-control roles; add the first generated migration and verify it applies to a clean database.
5. Implement admin authentication, session security, role-based access and initial audit logging.
6. Build CI for lint, type-check, tests, migration checks and production build; protect the main branch.
7. Add a production `Dockerfile` and `.env.example` so the app is hosting-agnostic; provision staging/production (domains, TLS, secrets, backups) only after the hosting decision.
8. Add health/readiness endpoints, structured logs and Sentry; add uptime checks once deployed.

**Exit gate:** a clean clone runs locally; CI passes; the Docker image builds and runs against a fresh database; migrations and health checks are verified.

### Phase 2 — Admin: products, inventory, coupons & catalog (Weeks 3–5)
The first feature work after the scaffold, built from the Phase 0 admin/coupon specification.

1. Finalize collection schemas for products, variants, stock levels, coupons, serviceable PIN codes, collections, pages, journal, care guides, customers and staff roles.
2. Add validation and database constraints for unique SKU/slug/coupon code/PIN, non-negative prices/stock, allowed product types and required shipping class.
3. Build admin product management: add, edit, publish/unpublish and archive products and variants, with media upload, care/scent attributes and SEO fields.
4. Build admin inventory management: view and adjust stock per variant, record a reason for each adjustment, and set low-stock thresholds.
5. Build admin coupon management: create, edit and activate/deactivate coupons (percent/fixed, minimum order, validity dates, usage limits, eligible products/collections).
6. Build the coupon service in `src/commerce/coupons`: validate code, status, dates, minimum order, usage limits and eligible items, then calculate the discount for a given set of lines. Cover each rule with unit tests.
7. Build admin PIN code management: add, edit, enable/disable and bulk-import serviceable live-plant PIN codes; seed the Bengaluru list.
8. Build and test a repeatable CSV import for products, variants and opening stock; import a small sample first.
9. Add Postgres full-text search and the product filtering fields needed by the approved catalog experience.
10. Import and review the launch catalog, images, SEO metadata, care/scent details and policy content.

**Exit gate:** staff can manage products, stock, coupons, PIN codes and content in `/admin` without engineering help; the coupon service passes its unit tests; imported records pass validation and search returns expected products.

### Phase 3 — Storefront experience (Weeks 4–7)
1. Implement the final Stitch design tokens, logo, typography, responsive grid, accessible primitives and the shared header, footer, announcement bar and delivery notice.
2. Build Home and Our Story using the approved Stitch references and real content/media.
3. Build collection/catalog and product-detail pages, including responsive filters, sorting, product options, PIN delivery check (serviceable list for live plants, PAN India for others) and related Calm Duo products.
4. Implement search, SEO metadata, sitemap, structured data, image optimization and CMS preview/revalidation.
5. Build cart, gift-note UI, account/order views and wishlist UI; wire them to typed server-side data access. Keep checkout mutations server-side.
6. Validate mobile/tablet/desktop behavior, keyboard navigation, focus visibility, reduced motion and image loading.

**Exit gate:** all agreed customer-facing pages render from real catalog/content data; design and accessibility checks pass at supported breakpoints.

### Phase 4 — Commerce core (Weeks 6–10)
1. Implement domain services for cart lines, variant pricing, bundles and the ₹150 gift add-on; cover totals with unit tests.
2. Wire the Phase 2 coupon service into the cart and checkout: apply the discount to cart totals, re-validate at order placement, and record redemptions atomically so usage limits can't be exceeded.
3. Implement transactional stock reservation, release/expiry, cancellation and fulfilment decrement; verify concurrent checkouts cannot oversell.
4. Implement delivery eligibility: live plants only to PINs in the serviceable list; artificial plants and candles to any valid Indian PIN; block checkout with a clear message for ineligible carts.
5. Define a provider-agnostic `PaymentProvider` interface (create payment, verify, handle webhook, refund) and the order payment states; implement a **mock provider** for development and tests. Do not integrate a real gateway yet. COD stays disabled.
6. Implement checkout: address, delivery check, coupon, order summary, order creation in `pending_payment`, and confirmation through the payment provider.
7. Queue email/WhatsApp order notifications and reservation-expiry jobs; add retry and failure visibility.
8. Integrate a courier API (e.g., Shiprocket) for PAN-India orders once a courier is chosen; until then, staff enter tracking details manually in `/admin`.
9. Integrate the storefront checkout with these services and test end-to-end using the mock provider.
10. **Once the gateway is chosen (Razorpay, Paytm, etc.):** implement its adapter, signature verification, idempotent webhooks and refunds, then test in its sandbox.

**Exit gate:** using the mock provider, test orders cover payment success/failure, coupon rules, delivery eligibility (live plant inside/outside the PIN list, PAN-India products), stock contention and cancellation without incorrect stock changes. Taking real payments additionally requires the chosen gateway adapter to pass its sandbox tests.

### Phase 5 — Operations and fulfillment (Weeks 9–11)
1. Complete admin order views and status transitions for payment review, packing, shipment, delivery, cancellation, refund and replacement.
2. Add stock adjustment and low-stock workflows, fulfillment notes and shipment/tracking visibility.
3. Implement verified-purchase review moderation and 14-day live-plant claim intake/review.
4. Add essential operational reports: orders, sales, coupon usage and inventory.
5. Write runbooks for order handling, failed payment/webhook recovery, refunds, plant claims, backups and incident escalation.
6. Train operations/content staff and rehearse a sample order from placement through delivery and refund/replacement.

**Exit gate:** a non-engineering operator can process the normal order lifecycle and recover the documented common failure cases using `/admin` and the runbook.

### Phase 6 — Verification, soft launch and go-live (Weeks 11–13)
1. Run unit/integration tests for pricing, coupons, inventory, delivery eligibility, checkout, permissions, migrations and payment webhook idempotency; fix release-blocking defects.
2. Run Playwright journeys on desktop and mobile: browse, search/filter, PIN check, gift option, coupon, online checkout, order status and admin fulfilment.
3. Complete accessibility, SEO, Lighthouse/Core Web Vitals and checkout load tests (expected peak ×3); tune or defer non-critical features if targets fail.
4. Complete security checks: dependency/secret scans, access-control review, rate limits, webhook signature checks, admin 2FA and backup restore drill.
5. Verify the hosting setup, production content, policies, chosen payment gateway live keys/webhooks, courier setup, WhatsApp templates, email DNS and analytics consent/configuration. Confirm GST obligations with a CA before taking live orders.
6. Conduct a small soft launch with real low-value orders; reconcile payments, stock and shipments manually.
7. Review launch metrics and open incidents, confirm rollback/owner coverage, then announce the public launch.
8. Monitor checkout errors, payment/webhook failures, stock, job failures, latency and support contacts closely for the first 72 hours.

**Exit gate:** pre-launch checklist in Appendix C is complete, soft-launch orders reconcile end-to-end, no release-blocking defects remain and an owner is assigned to every launch alert.

### Phase 7 — Post-launch (ongoing)
1. Review conversion, search terms, checkout drop-off, payment success, delivery performance and support themes weekly.
2. Fix issues and improve product/content operations before expanding scope.
3. Add deferred features as needed: GST calculation and invoices, COD, more live-plant cities (via the PIN list), automated review collection and self-serve bundle composition.
4. Evaluate gift cards, loyalty, subscriptions, WhatsApp commerce and multi-language based on customer demand and operational readiness.
5. Reassess scaling needs; add Redis/search service or split workers/services only when monitoring demonstrates a need.

### MVP scope cut line
**In:** catalog, search/filters, cart, online-only checkout (gateway adapter added once chosen), admin product/stock/coupon/PIN code management, Bengaluru live-plant delivery, PAN-India delivery for artificial plants and candles, order emails/WhatsApp, account, journal, curated Calm Duo pairing, verified reviews/photo testimonials and the ₹150 gift-note option.
**Later:** GST calculation and invoices, COD, courier API automation (if launch starts with manual tracking), more live-plant cities, self-serve custom bundle composition beyond curated ritual pairings, automated review collection, gift cards, loyalty, subscriptions, multi-language.

---

## 15. Team & Roles

| Role | Count | Notes |
|---|---|---|
| Full-stack engineer (lead) | 1–2 | Next.js + Payload + PostgreSQL; owns commerce core |
| UI/UX & brand designer | 1 | Part-time acceptable; owns design system |
| QA | 0.5 | Can be shared/automated early |
| Ops/catalog manager | 1 | Business side; admin user |
| Photographer/content | contract | Product + lifestyle imagery |

---

## 16. Cost Estimate (indicative, monthly, at launch)

| Item | Approx. |
|---|---|
| App host (1–2 containers) | ₹1,500–5,000 |
| Managed Postgres (with PITR) | ₹1,500–5,000 |
| Object storage/CDN/Cloudflare | ₹0–1,500 |
| Search / CMS | ₹0 (Postgres full-text search + Payload, both self-contained) |
| Email/SMS/WhatsApp | ₹1,000–5,000 (usage-based) |
| Sentry / uptime / logs | Free–$30 |
| Razorpay | ~2% per transaction (no monthly fee) |
| Shiprocket | Per-shipment rates (no fixed fee) |
| Domain | ~₹1,000/year |

Total fixed infra at launch is typically **₹5–15k/month**, growing with traffic. These are rough estimates; validate with vendor pricing before committing.

---

## 17. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Live plants die in transit | Specialised packaging, courier SLAs, pincode/season rules, DOA claim process, ship Mon–Thu |
| High COD RTO rate | COD confirmation via WhatsApp/OTP, prepaid incentives, pincode scoring, COD caps |
| Inventory mismatch (nursery stock is perishable) | Reservation logic, daily stock sync, per-batch quantities, low-stock alerts |
| Payment/webhook failures | Idempotent handlers, reconciliation job vs Razorpay, alerts |
| Scope creep delays launch | Strict MVP cut line (Section 14), post-launch backlog |
| Key-person dependency | Documentation, ADRs, runbooks, IaC |
| Traffic spikes from Instagram/festive sales | CDN/ISR caching, horizontal scaling of the app container, load test, jobs for slow work |
| Custom commerce code has bugs (cart, stock, GST) | Keep it isolated in `src/commerce/`, high unit/integration test coverage, Razorpay reconciliation job, staged rollout |
| Single app: admin and storefront share resources | Cache storefront at the CDN, run heavy reports/jobs off-peak or on a worker instance of the same image; split services later if needed |
| Compliance gaps (GST, DPDP, Legal Metrology) | Checklist review with CA/legal before launch |

---

## 18. Open Questions / Decisions Needed

1. Confirm build approach: single Next.js + Payload app (recommended) vs. Shopify; decide whether to adopt Payload's ecommerce plugin or build the commerce core fully in-house.
2. Do we hold own inventory in Bengaluru, or drop-ship some items? (affects fulfilment design)
3. **Payment gateway** (Razorpay, Paytm or other); online payment only at launch, COD disabled.
4. **Hosting provider** (see Section 10.5).
5. **GST timeline:** when to add GST calculation and invoices (deferred for now; confirm obligations with a CA before live sales).
6. Courier partner for PAN-India delivery (artificial plants and candles), or manual shipping at launch.
7. In-house engineering vs. agency/freelancers; budget ceiling.
8. Target launch date and any campaign (festival/Instagram) tied to it.

**Decided (24 Nov 2026):** live plants deliver only to the admin-managed PIN code list (Bengaluru at launch); artificial plants and candles deliver PAN India; COD disabled; Stitch designs and logo are final. See Section 14, Current MVP decisions.

---

## 19. Next Steps

1. Approve stack and MVP scope (Sections 1.3, 14).
2. Export final logo and design assets from Stitch (designs are approved).
3. Prepare the product catalog sheet (SKU, type, price, MRP, stock, images, care/scent attributes) and the Bengaluru live-plant PIN code list.
4. Scaffold the single Next.js + Payload app, CI and local Docker setup (Phase 1).
5. Decide payment gateway and hosting provider before checkout integration and staging setup.

---

### Appendix A — Suggested product attribute model
| Field | Live plant | Artificial plant | Candle | Combo |
|---|---|---|---|---|
| Title, description, images | ✔ | ✔ | ✔ | ✔ |
| Variants | pot finish, size | size, pot/finish | scent blend, size | components + ritual add-ons |
| Care level / light / water / pet-safe | ✔ | – | – | derived |
| Material | – | ✔ | wax type, vessel | – |
| Scent notes / burn time | – | – | ✔ | – |
| Product labels / badges | live plant, local transit, handcrafted | lifelike, zero care | pure soy, burn time | signature ritual pair |
| Dimensions & weight | ✔ | ✔ | ✔ | sum |
| HSN / GST rate | ✔ | ✔ | ✔ | per component |
| Gift note / gift box | optional order add-on | optional order add-on | optional order add-on | optional order add-on |
| Shipping class | Bengaluru live-plant courier | `standard` | protective PAN-India pack | most restrictive component |

### Appendix B — Environment variables (illustrative)
```
DATABASE_URL, PAYLOAD_SECRET, NEXT_PUBLIC_SITE_URL
RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, NEXT_PUBLIC_RAZORPAY_KEY_ID
SHIPROCKET_EMAIL, SHIPROCKET_PASSWORD, SHIPROCKET_WEBHOOK_TOKEN
S3_BUCKET, S3_REGION, S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, CDN_URL
RESEND_API_KEY, MSG91_AUTH_KEY, WHATSAPP_TOKEN
CRON_SECRET, TURNSTILE_SECRET_KEY, NEXT_PUBLIC_TURNSTILE_SITE_KEY
SENTRY_DSN, NEXT_PUBLIC_GA_ID, META_PIXEL_ID, META_CAPI_TOKEN
```
*Never commit real values; use `.env.example` with placeholders only.*

### Appendix C — Pre-launch checklist
- [ ] GST obligations confirmed with a CA (GST calculation/invoices deferred from MVP build)
- [ ] Chosen payment gateway in live mode, webhooks verified, refund tested
- [ ] Courier/shipping process verified (API or manual tracking entry)
- [ ] Live-plant PIN code list reviewed; PAN-India delivery checked for artificial plants and candles
- [ ] DLT templates approved; WhatsApp templates approved
- [ ] SPF/DKIM/DMARC passing; emails land in inbox
- [ ] Legal pages published (Privacy, Terms, Shipping, Returns, Contact, Grievance officer)
- [ ] Legal Metrology info on labels / PDP
- [ ] Lighthouse ≥ 90 mobile on Home/PLP/PDP; Core Web Vitals green
- [ ] Sitemap, robots, structured data, GA4/Pixel verified
- [ ] Backups + restore drill completed; alerts firing to the right people
- [ ] Load test passed; WAF + rate limits on
- [ ] 2FA enabled for all admin users; secrets rotated from test values
- [ ] Team trained on admin; runbook handed over

# The Calm Corner

Single Next.js + Payload application. Phases 1 (foundations) and 2 (admin: catalog, inventory,
coupons, PIN codes, search) are built. The storefront is still a placeholder; cart, checkout,
payments and the final design are later phases. All seeded products, PIN codes and the sample
coupon are synthetic and not for sale.

## Local setup

Requirements: Node.js 24.22.3 (or another version supported by `package.json`), Corepack, Docker
Desktop/Engine and Docker Compose. Ports 3000, 5432, 1025 and 8025 must be available.

```sh
corepack enable
cp .env.example .env
# Replace PAYLOAD_SECRET in .env with the output of: openssl rand -hex 32
docker compose up -d --wait
pnpm install --frozen-lockfile
pnpm migrate
pnpm seed
pnpm dev
```

Open `http://localhost:3000/admin` to create the first staff user, who becomes the owner. Do this
before exposing a new installation to anyone else: Payload's first-user registration is available
while no staff accounts exist. Use a unique password of at least 12 characters. Alternatively,
set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `.env` before running the seed; the seed never
changes an existing user. The seed is local-only and idempotent: it imports
`data/seed/*.sample.csv` (sample catalog and PIN codes, products left as drafts) and a `WELCOME10`
coupon.

Mailpit captures local mail at `http://localhost:8025`. Local uploads live in `media/`; the
PostgreSQL Compose volume persists until deliberately removed. `docker compose stop` stops the
services without deleting data.

## Admin: catalog, inventory, coupons and PIN codes (Phase 2)

Everything is managed in `/admin`, grouped in the sidebar. Money is stored as **integer paise**
(₹1 = 100 paise) and prices are final selling prices; no GST is calculated. CSV files use rupees.

| Area      | What staff can do                                                                                                                                                                                                                                                                                                                                                                                    |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog   | Products (draft → published → archived; use Archived rather than deleting), variants (SKU, size, finish, scent, price, MRP, weight), collections, care/scent attributes, SEO. Publishing needs a description, an image and an active variant. Shipping class is required and must match the type (live plants: `live_plant_bengaluru`; artificial plants: `standard`; candles: `candle_protective`). |
| Inventory | Quantities change only through **Stock adjustments** (append-only, with a reason; a note is required for loss, correction and other). Stock levels show on-hand, reserved, available and a low-stock flag; edit the threshold there. Adjustments are row-locked so concurrent changes can't oversell.                                                                                                |
| Coupons   | Percent or fixed, optional cap, minimum order, validity dates, total and per-customer limits, eligible products/collections, and an active switch (new coupons start inactive). `usedCount` is maintained by checkout (a later phase).                                                                                                                                                               |
| PIN codes | Serviceable live-plant PIN codes (area, ETA, enabled). Other products ship PAN India.                                                                                                                                                                                                                                                                                                                |

Roles: **owner** and **manager** manage catalog, coupons, PIN codes and imports; **fulfilment**
can also adjust stock; **support** can read stock, coupons and customers; **content** edits pages,
journal, care guides and media. Only owners manage staff and read the audit log. This matrix is an
assumption pending the Phase 0 role specification; adjust `src/access/roles.ts` if it differs.

**CSV import** (owner/manager): the Products and Serviceable PIN codes lists have an import panel
with a template download. _Validate only_ runs every real rule and saves nothing; _Import_ saves all
rows or none. Catalog CSVs are one row per variant (columns in the template); imported products are
created as drafts and re-importing updates by slug/SKU. Opening stock is applied once per variant.

**Search and filters**: Postgres full-text search (title > keywords > description) with a typo-tolerant
fallback, plus filters for type, fulfilment, light, pet-safe, aroma, finish, price and collection:
`GET /api/products/search?q=lavender&type=candle&sort=price_asc`. It returns published products
only. The same logic is available to server code as `findProducts` in `src/search/products.ts`.

**Coupon rules** live in `src/commerce/coupons` (`applyCoupon`): validity, limits, eligibility,
minimum on the eligible subtotal, percent rounded down, never above the eligible subtotal, with the
discount allocated per line.

The migration adds database CHECK constraints (non-negative whole-number money and stock, coupon and
PIN code formats) and the search indexes. It needs the `pg_trgm` extension, so the database user
must be allowed to run `CREATE EXTENSION` (or have it pre-installed). Replace the sample PIN codes
with the reviewed Bengaluru list via the import panel before launch. There is no catalog launch
data in this repository: import the real catalog the same way.

## Verification

```sh
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm audit --prod --audit-level high
```

Integration tests run only with `TEST_DATABASE_URL` set to a **dedicated disposable database**
already migrated with `pnpm migrate`. They create synthetic users and products and leave their
audit history in that database. Never point them at staging or production. CI provisions a fresh
PostgreSQL database, runs migrations and the integration tests, checks generated files, builds the
app and smoke-tests the Docker image.

`/health` is a liveness check; `/ready` checks PostgreSQL connectivity and that all committed
migrations are applied. Both return non-cacheable responses. Payload uses structured logging;
Sentry is disabled until the optional DSNs in `.env.example` are configured. The browser DSN is
embedded at build time; rebuild with `docker build --build-arg NEXT_PUBLIC_SENTRY_DSN=<dsn> ...`
after changing it.

## Schema and deployment

After changing Payload schemas, run `pnpm payload migrate:create <name>`, review and commit the
generated migration and snapshot, then run `pnpm migrate`. Regenerate and commit types and the
admin import map with `pnpm generate:types` and `pnpm generate:importmap`. Automatic schema push is
disabled. Apply migrations **before** starting a new app version, and use backward-compatible
expand/migrate/contract changes for deployments.

```sh
docker build -t the-calm-corner .
# Run migrations separately against the target database, then start:
docker run --env-file .env -p 3000:3000 the-calm-corner
```

Inside Docker, `localhost` refers to the container, not the host. Configure `DATABASE_URL` and SMTP
with reachable service addresses, and set `SERVER_URL` to the externally accessible
origin. Local HTTP container testing additionally requires `ALLOW_INSECURE_LOCAL=true`; this
exception accepts only localhost or 127.0.0.1. Real deployments require HTTPS, a unique secret,
SMTP host/from address and TLS (`SMTP_SECURE=true` or `SMTP_REQUIRE_TLS=true`); configure SMTP
credentials if your provider requires them. Use a persistent volume for local media or configure
S3-compatible storage using the `S3_*` variables. Do not rely on container-local files in
production. Set up domain/TLS, secrets, backups, uptime checks and a hosting provider separately.

Staff access is restricted by role: owners manage staff and read the audit log; managers manage
catalog and content; content editors manage content and media. Fulfilment and support are reserved
roles with no catalog write access yet. Audit entries record actor, operation, resource and ID,
not document contents or credentials. Admin 2FA, centralized log retention and production access
hardening remain launch prerequisites; the foundation alone is not ready to accept real orders.
Configure GitHub branch protection and required CI checks in repository settings; a workflow cannot
enforce those settings by itself.

import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Customer, Product, User, Variant } from '../src/payload-types'

const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('Phase 2 catalog, inventory and coupons', () => {
  let payload: Payload
  let owner: User
  let manager: User
  let fulfilment: User
  let content: User
  let customer: Customer
  let imageId: number
  const run = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const password = 'local-test-password-123'
  const slug = (name: string) => `${name}-${run}`
  const sku = (name: string) => `${name}-${run}`.toUpperCase()

  const staff = (user: User) => ({ user, overrideAccess: false as const })

  async function newProduct(
    name: string,
    extra: Partial<Product> = {},
  ): Promise<Product> {
    return payload.create({
      collection: 'products',
      data: {
        title: name,
        slug: slug(name),
        type: 'candle',
        shippingClass: 'candle_protective',
        status: 'draft',
        ...extra,
      },
      ...staff(manager),
    })
  }

  async function newVariant(
    product: Product,
    name: string,
    pricePaise: number,
    extra: Partial<Variant> = {},
  ): Promise<Variant> {
    return payload.create({
      collection: 'variants',
      data: { product: product.id, sku: sku(name), pricePaise, ...extra },
      ...staff(manager),
    })
  }

  async function publish(product: Product) {
    return payload.update({
      collection: 'products',
      id: product.id,
      data: {
        status: 'published',
        description: `${product.title} description`,
        images: [{ image: imageId }],
      },
      ...staff(manager),
    })
  }

  async function onHand(variantId: number) {
    const { docs } = await payload.find({
      collection: 'stock-levels',
      where: { variant: { equals: variantId } },
      overrideAccess: true,
    })
    return docs[0]
  }

  const adjust = (
    variant: Variant,
    delta: number,
    reason: 'opening_stock' | 'restock' | 'loss' | 'damage' = 'restock',
    user: User = manager,
    note?: string,
  ) =>
    payload.create({
      collection: 'stock-adjustments',
      data: { variant: variant.id, location: 'Bengaluru', delta, reason, note },
      ...staff(user),
    })

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl
    process.env.PAYLOAD_SECRET = 'integration-test-secret-not-for-production'
    process.env.SERVER_URL = 'http://localhost:3000'
    const [{ getPayload }, { default: config }] = await Promise.all([
      import('payload'),
      import('../src/payload.config'),
    ])
    payload = await getPayload({ config })
    const mk = (role: User['role'], name: string, by?: User) =>
      payload.create({
        collection: 'users',
        data: { name, email: `${name}-${run}@example.test`, password, role },
        ...(by ? { user: by, overrideAccess: false } : {}),
      })
    // The first staff account becomes the owner, so create the owner first.
    owner = await mk('owner', 'owner')
    manager = await mk('manager', 'manager', owner)
    fulfilment = await mk('fulfilment', 'fulfilment', owner)
    content = await mk('content', 'content', owner)
    customer = await payload.create({
      collection: 'customers',
      data: {
        name: 'Customer',
        email: `customer-${run}@example.test`,
        password,
      },
    })
    const png = await sharp({
      create: { width: 4, height: 4, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer()
    const media = await payload.create({
      collection: 'media',
      data: { alt: 'Test image' },
      file: {
        data: png,
        mimetype: 'image/png',
        name: `test-${run}.png`,
        size: png.length,
      },
    })
    imageId = media.id
  }, 60000)

  afterAll(async () => {
    if (payload) await payload.destroy()
  })

  describe('products and variants', () => {
    it('enforces slug, shipping class and publishing rules', async () => {
      await expect(
        payload.create({
          collection: 'products',
          data: {
            title: 'Bad',
            slug: 'Bad Slug',
            type: 'candle',
            shippingClass: 'candle_protective',
            status: 'draft',
          },
          ...staff(manager),
        }),
      ).rejects.toThrow()
      await expect(
        payload.create({
          collection: 'products',
          data: {
            title: 'Plant',
            slug: slug('wrong-class'),
            type: 'live_plant',
            shippingClass: 'standard',
            status: 'draft',
          },
          ...staff(manager),
        }),
      ).rejects.toMatchObject({ data: { errors: [{ path: 'shippingClass' }] } })

      const product = await newProduct('publish-rules')
      await expect(publish(product)).rejects.toMatchObject({
        data: {
          errors: [
            {
              path: 'status',
              message: expect.stringMatching(/active variant/),
            },
          ],
        },
      })
      await expect(
        payload.create({
          collection: 'products',
          data: {
            title: 'Direct',
            slug: slug('direct'),
            type: 'candle',
            shippingClass: 'candle_protective',
            status: 'published',
          },
          ...staff(manager),
        }),
      ).rejects.toThrow()

      await newVariant(product, 'publish-rules', 50000)
      await expect(
        payload.update({
          collection: 'products',
          id: product.id,
          data: { status: 'published' },
          ...staff(manager),
        }),
      ).rejects.toThrow()
      const published = await publish(product)
      expect(published.status).toBe('published')
    })

    it('validates prices and keeps SKUs unique', async () => {
      const product = await newProduct('variant-rules')
      await newVariant(product, 'dup', 1000)
      await expect(newVariant(product, 'dup', 1000)).rejects.toThrow()
      await expect(newVariant(product, 'neg', -1)).rejects.toThrow()
      await expect(newVariant(product, 'frac', 10.5)).rejects.toThrow()
      await expect(
        newVariant(product, 'mrp', 1000, { compareAtPaise: 900 }),
      ).rejects.toThrow()
      await expect(
        payload.create({
          collection: 'variants',
          data: { product: product.id, sku: 'bad sku!', pricePaise: 100 },
          ...staff(manager),
        }),
      ).rejects.toThrow()
    })

    it('rejects invalid values at the database even if the app is bypassed', async () => {
      const product = await newProduct('db-checks')
      const db = (
        payload.db as unknown as {
          drizzle: { execute: (q: unknown) => Promise<unknown> }
        }
      ).drizzle
      await expect(
        db.execute(
          sql`INSERT INTO variants (product_id, sku, price_paise) VALUES (${product.id}, ${sku('raw')}, -5)`,
        ),
      ).rejects.toThrow()
      await expect(
        db.execute(
          sql`INSERT INTO serviceable_pincodes (pincode, city) VALUES ('12', 'X')`,
        ),
      ).rejects.toThrow()
      await expect(
        db.execute(
          sql`INSERT INTO coupons (code, type, value) VALUES (${`RAW${run}`}, 'percent', 150)`,
        ),
      ).rejects.toThrow()
    })

    it('keeps the product minimum price in sync with active variants', async () => {
      const product = await newProduct('min-price')
      const cheap = await newVariant(product, 'min-cheap', 30000)
      await newVariant(product, 'min-dear', 90000)
      const read = () =>
        payload.findByID({
          collection: 'products',
          id: product.id,
          overrideAccess: true,
        })
      expect((await read()).minPricePaise).toBe(30000)
      await payload.update({
        collection: 'variants',
        id: cheap.id,
        data: { active: false },
        ...staff(manager),
      })
      expect((await read()).minPricePaise).toBe(90000)
      await payload.delete({
        collection: 'variants',
        id: cheap.id,
        user: owner,
        overrideAccess: false,
      })
      expect((await read()).minPricePaise).toBe(90000)
    })

    it('hides draft products and their variants from the public and restricts writes', async () => {
      const product = await newProduct('visibility')
      const variant = await newVariant(product, 'visibility', 1000)
      const publicVariants = await payload.find({
        collection: 'variants',
        where: { id: { equals: variant.id } },
        overrideAccess: false,
      })
      expect(publicVariants.totalDocs).toBe(0)
      await expect(
        newVariant(product, 'by-content', 100, {}),
      ).resolves.toBeTruthy()
      await expect(
        payload.create({
          collection: 'variants',
          data: {
            product: product.id,
            sku: sku('content-write'),
            pricePaise: 100,
          },
          ...staff(content),
        }),
      ).rejects.toThrow()
      await publish(product)
      const visible = await payload.find({
        collection: 'variants',
        where: { id: { equals: variant.id } },
        overrideAccess: false,
      })
      expect(visible.totalDocs).toBe(1)
    })
  })

  describe('inventory', () => {
    it('adjusts stock with a ledger and a low-stock flag', async () => {
      const product = await newProduct('stock-flow')
      const variant = await newVariant(product, 'stock-flow', 1000)
      const opening = await adjust(variant, 10, 'opening_stock', fulfilment)
      expect(opening).toMatchObject({ previousOnHand: 0, newOnHand: 10 })
      let level = await onHand(variant.id)
      expect(level).toMatchObject({
        onHand: 10,
        available: 10,
        isLowStock: false,
      })

      await adjust(variant, -6, 'damage')
      level = await onHand(variant.id)
      expect(level).toMatchObject({ onHand: 4, available: 4, isLowStock: true })

      await expect(adjust(variant, -5, 'damage')).rejects.toMatchObject({
        data: { errors: [{ path: 'delta' }] },
      })
      expect((await onHand(variant.id)).onHand).toBe(4)
      await expect(adjust(variant, -1, 'loss')).rejects.toMatchObject({
        data: { errors: [{ path: 'note' }] },
      })
      await adjust(variant, -1, 'loss', manager, 'Counted short')
      expect((await onHand(variant.id)).onHand).toBe(3)
    })

    it('protects quantities from direct edits and keeps the ledger append-only', async () => {
      const product = await newProduct('stock-protect')
      const variant = await newVariant(product, 'stock-protect', 1000)
      const entry = await adjust(variant, 5, 'opening_stock')
      const level = await onHand(variant.id)
      await payload.update({
        collection: 'stock-levels',
        id: level.id,
        data: { onHand: 500, lowStockThreshold: 9 },
        ...staff(manager),
      })
      expect(await onHand(variant.id)).toMatchObject({
        onHand: 5,
        available: 5,
        lowStockThreshold: 9,
        isLowStock: true,
      })
      await expect(
        payload.update({
          collection: 'stock-adjustments',
          id: entry.id,
          data: { delta: 99 },
          ...staff(owner),
        }),
      ).rejects.toThrow()
      await expect(
        payload.delete({
          collection: 'stock-adjustments',
          id: entry.id,
          ...staff(owner),
        }),
      ).rejects.toThrow()
      await expect(adjust(variant, 1, 'restock', content)).rejects.toThrow()
      await expect(
        payload.create({
          collection: 'stock-levels',
          data: {
            variant: variant.id,
            location: 'Other',
            onHand: 100,
            reserved: 0,
            available: 100,
            lowStockThreshold: 1,
            isLowStock: false,
          },
          ...staff(manager),
        }),
      ).rejects.toThrow()
    })

    it('never oversells under concurrent adjustments', async () => {
      const product = await newProduct('stock-race')
      const variant = await newVariant(product, 'stock-race', 1000)
      await adjust(variant, 5, 'opening_stock')
      const results = await Promise.allSettled(
        Array.from({ length: 12 }, () => adjust(variant, -1, 'damage')),
      )
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(5)
      expect(await onHand(variant.id)).toMatchObject({
        onHand: 0,
        available: 0,
      })
    })
  })

  describe('coupons', () => {
    it('validates coupon data and restricts access to staff', async () => {
      const code = `SPRING${run}`
      const base = { code, type: 'percent' as const, value: 10 }
      await expect(
        payload.create({
          collection: 'coupons',
          data: { ...base, value: 150 },
          ...staff(manager),
        }),
      ).rejects.toThrow()
      await expect(
        payload.create({
          collection: 'coupons',
          data: { ...base, code: 'x!' },
          ...staff(manager),
        }),
      ).rejects.toThrow()
      await expect(
        payload.create({
          collection: 'coupons',
          data: {
            ...base,
            validFrom: '2026-12-10T00:00:00Z',
            validTo: '2026-12-01T00:00:00Z',
          },
          ...staff(manager),
        }),
      ).rejects.toThrow()
      const coupon = await payload.create({
        collection: 'coupons',
        data: { ...base, code: code.toLowerCase(), usedCount: 99 },
        ...staff(manager),
      })
      expect(coupon).toMatchObject({ code, active: false, usedCount: 0 })
      await expect(
        payload.create({
          collection: 'coupons',
          data: base,
          ...staff(manager),
        }),
      ).rejects.toThrow()
      await expect(
        payload.create({
          collection: 'coupons',
          data: { ...base, code: `OTHER${run}` },
          ...staff(content),
        }),
      ).rejects.toThrow()
      await expect(
        payload.find({ collection: 'coupons', overrideAccess: false }),
      ).rejects.toThrow()
      await expect(
        payload.find({
          collection: 'coupons',
          user: customer as never,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
      await payload.update({
        collection: 'coupons',
        id: coupon.id,
        data: { active: true },
        ...staff(manager),
      })
    })

    it('loads a coupon and applies it to a bag', async () => {
      const { applyCoupon, findCouponByCode } =
        await import('../src/commerce/coupons')
      const code = `BAG${run}`
      await payload.create({
        collection: 'coupons',
        data: {
          code,
          type: 'fixed',
          value: 5000,
          minOrderPaise: 20000,
          active: true,
        },
        ...staff(manager),
      })
      const rule = await findCouponByCode(payload, code.toLowerCase())
      expect(rule).not.toBeNull()
      const lines = [{ productId: '1', unitPricePaise: 30000, quantity: 1 }]
      expect(applyCoupon(rule, lines, { now: new Date() })).toMatchObject({
        valid: true,
        discountPaise: 5000,
      })
      expect(
        applyCoupon(rule, [{ ...lines[0], unitPricePaise: 100 }], {
          now: new Date(),
        }),
      ).toMatchObject({
        reason: 'minimum_not_met',
      })
    })
  })

  describe('delivery PIN codes', () => {
    it('validates PIN codes and enforces uniqueness and roles', async () => {
      const pin = String(600000 + (Number(run) % 99999)).padStart(6, '6')
      const create = (data: Record<string, unknown>, user = manager) =>
        payload.create({
          collection: 'serviceable-pincodes',
          data: { pincode: pin, city: 'Bengaluru', ...data } as never,
          ...staff(user),
        })
      await expect(create({ pincode: '12345' })).rejects.toThrow()
      await expect(create({ pincode: '012345' })).rejects.toThrow()
      await expect(create({ etaMinDays: 3, etaMaxDays: 1 })).rejects.toThrow()
      const created = await create({})
      expect(created).toMatchObject({ enabled: true })
      await expect(create({})).rejects.toThrow()
      await expect(create({ pincode: '699999' }, content)).rejects.toThrow()
      const disabled = await payload.update({
        collection: 'serviceable-pincodes',
        id: created.id,
        data: { enabled: false },
        ...staff(manager),
      })
      expect(disabled.enabled).toBe(false)
    })

    it('bulk imports with validation-only, apply and update modes', async () => {
      const { importPincodes } = await import('../src/catalog/importPincodes')
      const base = 700000 + (Number(run) % 90000)
      const csv = `pincode,area,enabled\n${base},One,yes\n${base + 1},Two,no\n`
      const count = () =>
        payload.count({
          collection: 'serviceable-pincodes',
          where: { pincode: { in: [String(base), String(base + 1)] } },
          overrideAccess: true,
        })
      const dry = await importPincodes(payload, manager, csv, false)
      expect(dry).toMatchObject({
        ok: true,
        applied: false,
        summary: { created: 2 },
      })
      expect((await count()).totalDocs).toBe(0)
      expect(await importPincodes(payload, manager, csv, true)).toMatchObject({
        ok: true,
        applied: true,
      })
      expect((await count()).totalDocs).toBe(2)
      const again = await importPincodes(
        payload,
        manager,
        `pincode,enabled\n${base},no\n`,
        true,
      )
      expect(again.summary).toEqual({ created: 0, updated: 1 })
      const bad = await importPincodes(
        payload,
        manager,
        `pincode\n${base + 5}\nabc\n`,
        true,
      )
      expect(bad).toMatchObject({
        ok: false,
        applied: false,
        errors: [{ row: 3 }],
      })
      expect(
        (
          await payload.count({
            collection: 'serviceable-pincodes',
            where: { pincode: { equals: String(base + 5) } },
            overrideAccess: true,
          })
        ).totalDocs,
      ).toBe(0)
    })
  })

  describe('CSV catalog import', () => {
    const header =
      'product_slug,product_title,product_type,shipping_class,sku,price_inr,finish,opening_stock,low_stock_threshold,aroma_notes,description'
    const file = (...rows: string[]) => [header, ...rows].join('\n')
    const a = () => `imp-a-${run}`
    const csv = () =>
      file(
        `${a()},Import candle,candle,candle_protective,${sku('imp1')},499.50,raw terracotta,8,2,Lavender Fog|Warm Vanilla,Imported`,
        `${a()},Import candle,candle,candle_protective,${sku('imp2')},599,,0,,,`,
      )

    it('validates without saving, then imports, then updates idempotently', async () => {
      const { importCatalog } = await import('../src/catalog/importCatalog')
      const find = () =>
        payload.find({
          collection: 'products',
          where: { slug: { equals: a() } },
          overrideAccess: true,
        })

      const dry = await importCatalog(payload, manager, csv(), false)
      expect(dry).toMatchObject({
        ok: true,
        applied: false,
        summary: {
          productsCreated: 1,
          variantsCreated: 2,
          stockInitialised: 1,
        },
      })
      expect((await find()).totalDocs).toBe(0)
      expect(
        await payload.count({
          collection: 'variants',
          where: { sku: { equals: sku('imp1') } },
          overrideAccess: true,
        }),
      ).toMatchObject({ totalDocs: 0 })

      const applied = await importCatalog(payload, manager, csv(), true)
      expect(applied).toMatchObject({ ok: true, applied: true })
      const product = (await find()).docs[0]
      expect(product).toMatchObject({
        status: 'draft',
        minPricePaise: 49950,
        candleSpec: { aromaNotes: ['lavender fog', 'warm vanilla'] },
      })
      const variants = await payload.find({
        collection: 'variants',
        where: { product: { equals: product.id } },
        sort: 'pricePaise',
        overrideAccess: true,
      })
      expect(
        variants.docs.map((v) => [v.sku, v.pricePaise, v.finish ?? null]),
      ).toEqual([
        [sku('imp1'), 49950, 'raw terracotta'],
        [sku('imp2'), 59900, null],
      ])
      expect(await onHand(variants.docs[0].id)).toMatchObject({
        onHand: 8,
        lowStockThreshold: 2,
      })

      const rerun = await importCatalog(
        payload,
        manager,
        csv().replace('499.50', '450'),
        true,
      )
      expect(rerun.summary).toMatchObject({
        productsUpdated: 1,
        variantsUpdated: 2,
        variantsCreated: 0,
        stockInitialised: 0,
        stockSkipped: 1,
      })
      expect(await onHand(variants.docs[0].id)).toMatchObject({ onHand: 8 })
      expect((await find()).docs[0].minPricePaise).toBe(45000)
    })

    it('reports every problem and writes nothing when any row is invalid', async () => {
      const { importCatalog } = await import('../src/catalog/importCatalog')
      const owned = sku('imp1')
      const result = await importCatalog(
        payload,
        manager,
        file(
          `other-${run},Other,candle,candle_protective,${owned},100,,,,,`,
          `bad-${run},Bad,live_plant,standard,${sku('bad')},100,,,,,`,
        ),
        true,
      )
      expect(result.ok).toBe(false)
      expect(result.errors.map((e) => e.row)).toEqual([3])
      const conflict = await importCatalog(
        payload,
        manager,
        file(`other-${run},Other,candle,candle_protective,${owned},100,,,,,`),
        true,
      )
      expect(conflict.errors[0]).toMatchObject({
        row: 2,
        message: expect.stringMatching(/already belongs to product/),
      })
      expect(
        (
          await payload.count({
            collection: 'products',
            where: { slug: { equals: `other-${run}` } },
            overrideAccess: true,
          })
        ).totalDocs,
      ).toBe(0)
    })
  })

  describe('search and filtering', () => {
    const term = `zenwick${run}`.toLowerCase()
    let candle: Product
    let plant: Product

    beforeAll(async () => {
      candle = await newProduct(`${term} lavender candle`, {
        slug: slug('search-candle'),
        searchKeywords: 'aromatherapy gift',
        candleSpec: { aromaNotes: ['lavender fog'] },
        collections: [],
      })
      await newVariant(candle, 'search-candle', 70000, {
        finish: 'matte olive',
      })
      await publish(candle)
      plant = await newProduct(`${term} fern`, {
        slug: slug('search-plant'),
        type: 'live_plant',
        shippingClass: 'live_plant_bengaluru',
        plantCare: { light: 'low_light', petSafe: true },
      })
      await newVariant(plant, 'search-plant', 120000, {
        finish: 'raw terracotta',
      })
      await publish(plant)
      const draft = await newProduct(`${term} draft`, {
        slug: slug('search-draft'),
      })
      await newVariant(draft, 'search-draft', 10000)
    })

    it('searches full text across title and keywords, tolerating typos, for published products only', async () => {
      const { searchProductIds } = await import('../src/search/products')
      expect(await searchProductIds(payload, `${term} candle`)).toEqual([
        candle.id,
      ])
      expect(await searchProductIds(payload, 'aromatherapy')).toContain(
        candle.id,
      )
      expect(await searchProductIds(payload, `${term} candles`)).toContain(
        candle.id,
      )
      expect(
        await searchProductIds(
          payload,
          `${term.replace('wick', 'wik')} candle`,
        ),
      ).toContain(candle.id)
      const all = await searchProductIds(payload, term)
      expect(all.sort()).toEqual([candle.id, plant.id].sort())
      expect(await searchProductIds(payload, '')).toEqual([])
      expect(
        await searchProductIds(payload, "'; DROP TABLE products; --"),
      ).toEqual([])
    })

    it('filters and sorts the public catalog', async () => {
      const { findProducts } = await import('../src/search/products')
      const ids = async (filters: Parameters<typeof findProducts>[1]) =>
        (await findProducts(payload, { q: term, ...filters })).docs.map(
          (d) => d.id,
        )
      expect(await ids({ type: 'candle' })).toEqual([candle.id])
      expect(await ids({ fulfilment: 'bengaluru_same_day' })).toEqual([
        plant.id,
      ])
      expect(await ids({ fulfilment: 'pan_india' })).toEqual([candle.id])
      expect(await ids({ light: ['low_light'], petSafe: true })).toEqual([
        plant.id,
      ])
      expect(await ids({ aroma: ['Lavender Fog'] })).toEqual([candle.id])
      expect(await ids({ finish: ['raw terracotta'] })).toEqual([plant.id])
      expect(await ids({ minPricePaise: 100000 })).toEqual([plant.id])
      expect(await ids({ maxPricePaise: 100000 })).toEqual([candle.id])
      expect(await ids({ sort: 'price_desc' })).toEqual([plant.id, candle.id])
      expect(await ids({ sort: 'price_asc' })).toEqual([candle.id, plant.id])
      const page = await findProducts(payload, {
        q: term,
        limit: 1,
        page: 2,
        sort: 'price_asc',
      })
      expect(page).toMatchObject({ totalDocs: 2, page: 2, totalPages: 2 })
      expect(page.docs.map((d) => d.id)).toEqual([plant.id])
    })
  })

  describe('customers and audit', () => {
    it('keeps customers out of staff data and limits them to their own record', async () => {
      await expect(
        payload.find({
          collection: 'audit-logs',
          user: customer as never,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
      await expect(
        payload.find({
          collection: 'users',
          user: customer as never,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
      const customers = await payload.find({
        collection: 'customers',
        user: customer as never,
        overrideAccess: false,
      })
      expect(customers.docs.map((c) => c.id)).toEqual([customer.id])
      await expect(
        payload.create({
          collection: 'customers',
          data: { name: 'X', email: `x-${run}@example.test`, password },
          overrideAccess: false,
        }),
      ).rejects.toThrow()
    })

    it('records catalog and stock changes with the acting user', async () => {
      const product = await newProduct('audited')
      const logs = await payload.find({
        collection: 'audit-logs',
        where: {
          and: [
            { resource: { equals: 'products' } },
            { targetId: { equals: String(product.id) } },
          ],
        },
      })
      expect(logs.docs.map((l) => [l.action, l.actorId])).toEqual([
        ['create', String(manager.id)],
      ])
      const variant = await newVariant(product, 'audited', 100)
      await adjust(variant, 3, 'opening_stock', fulfilment)
      const stockLogs = await payload.find({
        collection: 'audit-logs',
        where: {
          and: [
            { resource: { equals: 'stock-adjustments' } },
            { actorId: { equals: String(fulfilment.id) } },
          ],
        },
      })
      expect(stockLogs.totalDocs).toBeGreaterThan(0)
    })
  })
})

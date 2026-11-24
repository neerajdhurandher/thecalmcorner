import type { Payload, PayloadRequest } from 'payload'
import { z } from 'zod'
import { ensureStockLevel } from '../commerce/inventory/adjust'
import { DEFAULT_LOCATION } from '../commerce/inventory/stock'
import { SLUG_PATTERN } from '../fields/common'
import {
  parseBoolean,
  parseCsv,
  rupeesToPaise,
  type RowError,
} from '../lib/csv'
import {
  describeError,
  runInTransaction,
  type ImportResult,
} from '../lib/importRunner'
import {
  BADGES,
  DIFFICULTY_LEVELS,
  LIGHT_LEVELS,
  PRODUCT_TYPES,
  SHIPPING_CLASSES,
  SKU_PATTERN,
  WATER_LEVELS,
  normaliseTag,
  shippingClassError,
} from './rules'

export const CATALOG_COLUMNS = {
  required: [
    'product_slug',
    'product_title',
    'product_type',
    'shipping_class',
    'sku',
    'price_inr',
  ],
  optional: [
    'description',
    'light',
    'water',
    'difficulty',
    'pet_safe',
    'aroma_notes',
    'badges',
    'material',
    'burn_hours',
    'search_keywords',
    'size',
    'finish',
    'scent',
    'mrp_inr',
    'weight_g',
    'opening_stock',
    'low_stock_threshold',
  ],
} as const

export const CATALOG_TEMPLATE =
  [
    [...CATALOG_COLUMNS.required, ...CATALOG_COLUMNS.optional].join(','),
    'sample-fern,Sample fern,live_plant,live_plant_bengaluru,FERN-S-SAND,899,"A sample plant.",low_light,moderate,easy,yes,,live_plant,,,,small,speckled sandstone,,999,900,10,3',
  ].join('\n') + '\n'

const money = (label: string) =>
  z.string().transform((v, ctx) => {
    const paise = rupeesToPaise(v)
    if (paise === null) {
      ctx.addIssue({
        code: 'custom',
        message: `${label} must be an amount like 499 or 499.50.`,
      })
      return z.NEVER
    }
    return paise
  })
const integer = (label: string, min = 0) =>
  z.string().transform((v, ctx) => {
    if (!/^\d{1,7}$/.test(v) || Number(v) < min) {
      ctx.addIssue({
        code: 'custom',
        message: `${label} must be a whole number of at least ${min}.`,
      })
      return z.NEVER
    }
    return Number(v)
  })
const list = (values: readonly string[], label: string) =>
  z.string().transform((v, ctx) => {
    const items = v.split('|').map(normaliseTag).filter(Boolean)
    const bad = values.length
      ? items.find((i) => !values.includes(i))
      : undefined
    if (bad) {
      ctx.addIssue({
        code: 'custom',
        message: `${label}: "${bad}" is not allowed (${values.join(', ')}).`,
      })
      return z.NEVER
    }
    return items
  })
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    schema.optional(),
  )

const rowSchema = z.object({
  product_slug: z
    .string()
    .regex(
      SLUG_PATTERN,
      'product_slug must be lowercase letters, numbers and hyphens.',
    ),
  product_title: z.string().min(1).max(200),
  product_type: z.enum(PRODUCT_TYPES),
  shipping_class: z.enum(SHIPPING_CLASSES),
  sku: z
    .string()
    .transform((v) => v.toUpperCase())
    .pipe(
      z
        .string()
        .regex(
          SKU_PATTERN,
          'sku must be 2–40 characters: A–Z, 0–9, ".", "_" or "-".',
        ),
    ),
  price_inr: money('price_inr'),
  description: optional(z.string().max(5000)),
  light: optional(z.enum(LIGHT_LEVELS)),
  water: optional(z.enum(WATER_LEVELS)),
  difficulty: optional(z.enum(DIFFICULTY_LEVELS)),
  pet_safe: optional(
    z.string().transform((v, ctx) => {
      const b = parseBoolean(v)
      if (b === null) {
        ctx.addIssue({ code: 'custom', message: 'pet_safe must be yes or no.' })
        return z.NEVER
      }
      return b
    }),
  ),
  aroma_notes: optional(list([], 'aroma_notes')),
  badges: optional(list(BADGES, 'badges')),
  material: optional(z.string().max(200)),
  burn_hours: optional(integer('burn_hours', 1)),
  search_keywords: optional(z.string().max(300)),
  size: optional(z.string().max(100)),
  finish: optional(z.string().max(100).transform(normaliseTag)),
  scent: optional(z.string().max(100).transform(normaliseTag)),
  mrp_inr: optional(money('mrp_inr')),
  weight_g: optional(integer('weight_g')),
  opening_stock: optional(integer('opening_stock')),
  low_stock_threshold: optional(integer('low_stock_threshold')),
})
type Row = z.infer<typeof rowSchema>

const PRODUCT_KEYS = [
  'product_title',
  'product_type',
  'shipping_class',
  'description',
  'light',
  'water',
  'difficulty',
  'pet_safe',
  'aroma_notes',
  'badges',
  'material',
  'burn_hours',
  'search_keywords',
] as const

type ParsedRow = { row: number; data: Row }

export function validateCatalogRows(text: string) {
  const parsed = parseCsv(text, CATALOG_COLUMNS, 1000)
  const errors: RowError[] = [...parsed.errors]
  const rows: ParsedRow[] = []
  const skus = new Map<string, number>()
  const products = new Map<string, { row: number; data: Row }>()
  for (const { row, values } of parsed.rows) {
    const result = rowSchema.safeParse(values)
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = String(issue.path[0] ?? '')
        errors.push({
          row,
          message: issue.message.startsWith(field)
            ? issue.message
            : `${field}: ${issue.message}`,
        })
      }
      continue
    }
    const data = result.data
    const rowErrors: string[] = []
    const classError = shippingClassError(
      data.product_type,
      data.shipping_class,
    )
    if (classError) rowErrors.push(classError)
    if (data.mrp_inr != null && data.mrp_inr < data.price_inr) {
      rowErrors.push('mrp_inr must be at least price_inr.')
    }
    if (
      data.product_type !== 'live_plant' &&
      (data.light || data.water || data.difficulty || data.pet_safe != null)
    ) {
      rowErrors.push(
        'light, water, difficulty and pet_safe apply to live plants only.',
      )
    }
    if (
      data.product_type !== 'candle' &&
      (data.aroma_notes || data.burn_hours)
    ) {
      rowErrors.push('aroma_notes and burn_hours apply to candles only.')
    }
    const previousSku = skus.get(data.sku)
    if (previousSku)
      rowErrors.push(`SKU ${data.sku} is also on row ${previousSku}.`)
    skus.set(data.sku, row)

    const first = products.get(data.product_slug)
    if (!first) {
      products.set(data.product_slug, { row, data })
    } else {
      for (const key of PRODUCT_KEYS) {
        const a = first.data[key]
        const b = data[key]
        if (
          b !== undefined &&
          a !== undefined &&
          JSON.stringify(a) !== JSON.stringify(b)
        ) {
          rowErrors.push(
            `${key} differs from row ${first.row} for the same product.`,
          )
        } else if (a === undefined && b !== undefined) {
          first.data = { ...first.data, [key]: b }
        }
      }
    }
    for (const message of rowErrors) errors.push({ row, message })
    rows.push({ row, data })
  }
  return { rows, errors, products }
}

export async function importCatalog(
  payload: Payload,
  user: PayloadRequest['user'],
  text: string,
  apply: boolean,
  location = DEFAULT_LOCATION,
): Promise<ImportResult> {
  const { rows, errors, products } = validateCatalogRows(text)
  if (errors.length > 0) {
    return { ok: false, applied: false, summary: {}, errors }
  }

  // Read-only conflict check so every clash is reported at once.
  const conflictErrors: RowError[] = []
  const existingVariants = await payload.find({
    collection: 'variants',
    where: { sku: { in: rows.map((r) => r.data.sku) } },
    limit: rows.length,
    depth: 1,
    pagination: false,
    overrideAccess: true,
  })
  for (const variant of existingVariants.docs) {
    const owner =
      typeof variant.product === 'object' ? variant.product.slug : undefined
    const row = rows.find((r) => r.data.sku === variant.sku)
    if (row && owner && owner !== row.data.product_slug) {
      conflictErrors.push({
        row: row.row,
        message: `SKU ${variant.sku} already belongs to product "${owner}".`,
      })
    }
  }
  if (conflictErrors.length > 0) {
    return { ok: false, applied: false, summary: {}, errors: conflictErrors }
  }

  return runInTransaction(payload, user, apply, async (req) => {
    const summary = {
      productsCreated: 0,
      productsUpdated: 0,
      variantsCreated: 0,
      variantsUpdated: 0,
      stockInitialised: 0,
      stockSkipped: 0,
    }
    const productIds = new Map<string, number>()
    let current = 0
    try {
      for (const { row, data } of rows) {
        current = row
        const slug = data.product_slug
        if (!productIds.has(slug)) {
          const product = products.get(slug)!.data
          const productData = {
            title: product.product_title,
            slug,
            type: product.product_type,
            shippingClass: product.shipping_class,
            ...(product.description && { description: product.description }),
            ...(product.material && { material: product.material }),
            ...(product.search_keywords && {
              searchKeywords: product.search_keywords,
            }),
            ...(product.badges && { badges: product.badges as never }),
            ...(product.product_type === 'live_plant' && {
              plantCare: {
                ...(product.light && { light: product.light }),
                ...(product.water && { water: product.water }),
                ...(product.difficulty && { difficulty: product.difficulty }),
                ...(product.pet_safe !== undefined && {
                  petSafe: product.pet_safe,
                }),
              },
            }),
            ...(product.product_type === 'candle' && {
              candleSpec: {
                ...(product.aroma_notes && { aromaNotes: product.aroma_notes }),
                ...(product.burn_hours && { burnHours: product.burn_hours }),
              },
            }),
          }
          const existing = await payload.find({
            collection: 'products',
            where: { slug: { equals: slug } },
            limit: 1,
            depth: 0,
            req,
            overrideAccess: true,
          })
          if (existing.docs[0]) {
            await payload.update({
              collection: 'products',
              id: existing.docs[0].id,
              data: productData,
              req,
              overrideAccess: true,
            })
            productIds.set(slug, existing.docs[0].id)
            summary.productsUpdated += 1
          } else {
            const created = await payload.create({
              collection: 'products',
              data: { ...productData, status: 'draft' },
              req,
              overrideAccess: true,
            })
            productIds.set(slug, created.id)
            summary.productsCreated += 1
          }
        }
        const productId = productIds.get(slug)!
        const variantData = {
          product: productId,
          sku: data.sku,
          pricePaise: data.price_inr,
          active: true,
          ...(data.size && { size: data.size }),
          ...(data.finish && { finish: data.finish }),
          ...(data.scent && { scent: data.scent }),
          ...(data.mrp_inr != null && { compareAtPaise: data.mrp_inr }),
          ...(data.weight_g != null && { weightG: data.weight_g }),
        }
        const existingVariant = await payload.find({
          collection: 'variants',
          where: { sku: { equals: data.sku } },
          limit: 1,
          depth: 0,
          req,
          overrideAccess: true,
        })
        let variantId: number
        if (existingVariant.docs[0]) {
          variantId = existingVariant.docs[0].id
          await payload.update({
            collection: 'variants',
            id: variantId,
            data: variantData,
            req,
            overrideAccess: true,
          })
          summary.variantsUpdated += 1
        } else {
          variantId = (
            await payload.create({
              collection: 'variants',
              data: variantData,
              req,
              overrideAccess: true,
            })
          ).id
          summary.variantsCreated += 1
        }

        const history = await payload.count({
          collection: 'stock-adjustments',
          where: {
            and: [
              { variant: { equals: variantId } },
              { location: { equals: location } },
            ],
          },
          req,
          overrideAccess: true,
        })
        if (data.opening_stock && data.opening_stock > 0) {
          if (history.totalDocs === 0) {
            await payload.create({
              collection: 'stock-adjustments',
              data: {
                variant: variantId,
                location,
                delta: data.opening_stock,
                reason: 'opening_stock',
                note: 'CSV import',
              },
              req,
              overrideAccess: true,
            })
            summary.stockInitialised += 1
          } else {
            summary.stockSkipped += 1
          }
        }
        if (data.low_stock_threshold != null) {
          await ensureStockLevel(
            req,
            variantId,
            location,
            data.low_stock_threshold,
          )
        }
      }
    } catch (error) {
      return {
        summary,
        errors: [{ row: current, message: describeError(error) }],
      }
    }
    return { summary, errors: [] }
  })
}

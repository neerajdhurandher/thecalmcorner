import { sql } from '@payloadcms/db-postgres'
import type { Payload, Where } from 'payload'
import type { Product } from '../payload-types'

export const MAX_QUERY_LENGTH = 100
const MAX_SEARCH_RESULTS = 200

export function cleanQuery(q: string | undefined | null): string {
  return (q ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH)
}

/**
 * Ranked ids of published products matching `q` using Postgres full-text search
 * (title > keywords > description), falling back to trigram matching for typos.
 */
export async function searchProductIds(
  payload: Payload,
  q: string,
  limit = MAX_SEARCH_RESULTS,
): Promise<number[]> {
  const query = cleanQuery(q)
  if (!query) return []
  const db = payload.db as unknown as {
    drizzle: { execute: (q: unknown) => Promise<{ rows: { id: number }[] }> }
  }
  const exact = await db.drizzle.execute(sql`
    SELECT p.id
    FROM products p, websearch_to_tsquery('english', ${query}) AS tsq
    WHERE p.status = 'published' AND p.search_vector @@ tsq
    ORDER BY ts_rank_cd(p.search_vector, tsq) DESC, p.id
    LIMIT ${Math.min(limit, MAX_SEARCH_RESULTS)}
  `)
  if (exact.rows.length > 0) return exact.rows.map((row) => Number(row.id))
  // Nothing matched exactly: fall back to trigram matching to tolerate typos.
  const { rows } = await db.drizzle.execute(sql`
    SELECT p.id
    FROM products p
    WHERE p.status = 'published' AND ${query} <% p.title
    ORDER BY word_similarity(${query}, p.title) DESC, p.id
    LIMIT ${Math.min(limit, MAX_SEARCH_RESULTS)}
  `)
  return rows.map((row) => Number(row.id))
}

export type CatalogFilters = {
  q?: string
  type?: Product['type']
  collectionSlug?: string
  fulfilment?: 'bengaluru_same_day' | 'pan_india'
  light?: string[]
  petSafe?: boolean
  aroma?: string[]
  finish?: string[]
  minPricePaise?: number
  maxPricePaise?: number
  sort?: 'relevance' | 'newest' | 'price_asc' | 'price_desc'
  page?: number
  limit?: number
}

export function buildProductWhere(
  filters: CatalogFilters,
  extra: { ids?: number[]; collectionId?: number | null } = {},
): Where {
  const and: Where[] = [{ status: { equals: 'published' } }]
  if (filters.type) and.push({ type: { equals: filters.type } })
  if (filters.fulfilment === 'bengaluru_same_day') {
    and.push({ shippingClass: { equals: 'live_plant_bengaluru' } })
  } else if (filters.fulfilment === 'pan_india') {
    and.push({ shippingClass: { not_equals: 'live_plant_bengaluru' } })
  }
  if (filters.light?.length)
    and.push({ 'plantCare.light': { in: filters.light } })
  if (filters.petSafe) and.push({ 'plantCare.petSafe': { equals: true } })
  if (filters.aroma?.length) {
    and.push({
      'candleSpec.aromaNotes': {
        in: filters.aroma.map((a) => a.toLowerCase()),
      },
    })
  }
  if (filters.minPricePaise != null) {
    and.push({ minPricePaise: { greater_than_equal: filters.minPricePaise } })
  }
  if (filters.maxPricePaise != null) {
    and.push({ minPricePaise: { less_than_equal: filters.maxPricePaise } })
  }
  if (extra.collectionId != null)
    and.push({ collections: { equals: extra.collectionId } })
  if (extra.ids) and.push({ id: { in: extra.ids.length ? extra.ids : [-1] } })
  return { and }
}

const SORTS = {
  newest: '-createdAt',
  price_asc: 'minPricePaise',
  price_desc: '-minPricePaise',
  relevance: '-createdAt',
} as const

/** Public catalog listing: only published products, respecting access rules. */
export async function findProducts(
  payload: Payload,
  filters: CatalogFilters = {},
) {
  const page = Math.max(1, filters.page ?? 1)
  const limit = Math.min(48, Math.max(1, filters.limit ?? 12))
  const query = cleanQuery(filters.q)
  const sort = SORTS[filters.sort ?? 'newest']

  let ids: number[] | undefined
  if (query) ids = await searchProductIds(payload, query)
  if (filters.finish?.length) {
    const variants = await payload.find({
      collection: 'variants',
      where: {
        and: [
          { finish: { in: filters.finish.map((f) => f.toLowerCase()) } },
          { active: { equals: true } },
        ],
      },
      depth: 0,
      pagination: false,
      overrideAccess: false,
    })
    const finishIds = new Set(
      variants.docs.map((v) =>
        typeof v.product === 'object' ? v.product.id : v.product,
      ),
    )
    ids = ids ? ids.filter((id) => finishIds.has(id)) : [...finishIds]
  }
  let collectionId: number | null | undefined
  if (filters.collectionSlug) {
    const { docs } = await payload.find({
      collection: 'product-collections',
      where: { slug: { equals: filters.collectionSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: false,
    })
    collectionId = docs[0]?.id ?? -1
  }
  const where = buildProductWhere(filters, { ids, collectionId })

  if (query && (filters.sort ?? 'relevance') === 'relevance') {
    // Keep the search ranking: fetch the (bounded) match set, order, then page.
    const all = await payload.find({
      collection: 'products',
      where,
      depth: 1,
      pagination: false,
      overrideAccess: false,
    })
    const rank = new Map((ids ?? []).map((id, index) => [id, index]))
    const ordered = all.docs.sort(
      (a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0),
    )
    return {
      docs: ordered.slice((page - 1) * limit, page * limit),
      totalDocs: ordered.length,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(ordered.length / limit)),
    }
  }
  const result = await payload.find({
    collection: 'products',
    where,
    sort,
    page,
    limit,
    depth: 1,
    overrideAccess: false,
  })
  return {
    docs: result.docs,
    totalDocs: result.totalDocs,
    page: result.page ?? page,
    limit,
    totalPages: result.totalPages,
  }
}

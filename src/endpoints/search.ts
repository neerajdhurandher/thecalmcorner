import type { Endpoint } from 'payload'
import { z } from 'zod'
import { PRODUCT_TYPES } from '../catalog/rules'
import { findProducts } from '../search/products'

const list = (v: string | null) =>
  v
    ? v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10)
    : undefined
const num = z.coerce.number().int().min(0).max(100_000_000).optional()

const params = z.object({
  q: z.string().max(100).optional(),
  type: z.enum(PRODUCT_TYPES).optional(),
  collection: z.string().max(100).optional(),
  fulfilment: z.enum(['bengaluru_same_day', 'pan_india']).optional(),
  petSafe: z.enum(['true', 'false']).optional(),
  sort: z.enum(['relevance', 'newest', 'price_asc', 'price_desc']).optional(),
  minPrice: num,
  maxPrice: num,
  page: z.coerce.number().int().min(1).max(1000).optional(),
  limit: z.coerce.number().int().min(1).max(48).optional(),
})

// Public, read-only product search and filtering (published products only).
export const searchEndpoint: Endpoint = {
  path: '/search',
  method: 'get',
  handler: async (req) => {
    const url = new URL(req.url ?? 'http://localhost')
    const get = (name: string) => url.searchParams.get(name) ?? undefined
    const parsed = params.safeParse({
      q: get('q'),
      type: get('type'),
      collection: get('collection'),
      fulfilment: get('fulfilment'),
      petSafe: get('petSafe'),
      sort: get('sort'),
      minPrice: get('minPrice'),
      maxPrice: get('maxPrice'),
      page: get('page'),
      limit: get('limit'),
    })
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid search parameters.' },
        { status: 400 },
      )
    }
    const p = parsed.data
    const result = await findProducts(req.payload, {
      q: p.q,
      type: p.type,
      collectionSlug: p.collection,
      fulfilment: p.fulfilment,
      petSafe: p.petSafe === 'true' ? true : undefined,
      light: list(url.searchParams.get('light')),
      aroma: list(url.searchParams.get('aroma')),
      finish: list(url.searchParams.get('finish')),
      minPricePaise: p.minPrice,
      maxPricePaise: p.maxPrice,
      sort: p.sort,
      page: p.page,
      limit: p.limit,
    })
    return Response.json({
      ...result,
      docs: result.docs.map((product) => ({
        id: product.id,
        title: product.title,
        slug: product.slug,
        type: product.type,
        minPricePaise: product.minPricePaise,
        shippingClass: product.shippingClass,
      })),
    })
  },
}

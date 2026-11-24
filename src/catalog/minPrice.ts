import type { PayloadRequest } from 'payload'

// Keeps products.minPricePaise (used for price filters/sorting) in step with variants.
export async function refreshMinPrice(
  req: PayloadRequest,
  productId: number | string,
) {
  const { docs } = await req.payload.find({
    collection: 'variants',
    where: {
      and: [{ product: { equals: productId } }, { active: { equals: true } }],
    },
    sort: 'pricePaise',
    limit: 1,
    depth: 0,
    req,
    overrideAccess: true,
  })
  const minPricePaise = docs[0]?.pricePaise ?? null
  const product = await req.payload.findByID({
    collection: 'products',
    id: productId,
    depth: 0,
    req,
    overrideAccess: true,
  })
  if (product.minPricePaise === minPricePaise) return
  await req.payload.update({
    collection: 'products',
    id: productId,
    data: { minPricePaise },
    req,
    overrideAccess: true,
  })
}

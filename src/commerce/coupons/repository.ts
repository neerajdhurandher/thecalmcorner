import type { Payload } from 'payload'
import type { Coupon } from '../../payload-types'
import type { CouponRule } from './types'
import { normaliseCode } from './validate'

const id = (value: number | { id: number }) =>
  String(typeof value === 'object' ? value.id : value)

export function couponToRule(doc: Coupon): CouponRule {
  return {
    code: doc.code,
    active: doc.active ?? false,
    type: doc.type,
    value: doc.value,
    maxDiscountPaise: doc.maxDiscountPaise,
    minOrderPaise: doc.minOrderPaise,
    validFrom: doc.validFrom ? new Date(doc.validFrom) : null,
    validTo: doc.validTo ? new Date(doc.validTo) : null,
    usageLimit: doc.usageLimit,
    usedCount: doc.usedCount ?? 0,
    perCustomerLimit: doc.perCustomerLimit,
    eligibleProductIds: (doc.eligibleProducts ?? []).map(id),
    eligibleCollectionIds: (doc.eligibleCollections ?? []).map(id),
  }
}

export async function findCouponByCode(
  payload: Payload,
  code: string,
): Promise<CouponRule | null> {
  const { docs } = await payload.find({
    collection: 'coupons',
    where: { code: { equals: normaliseCode(code) } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return docs[0] ? couponToRule(docs[0]) : null
}

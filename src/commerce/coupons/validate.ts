import type {
  CartLine,
  CouponContext,
  CouponFailure,
  CouponResult,
  CouponRule,
} from './types'

const MESSAGES: Record<CouponFailure, string> = {
  invalid_code: 'This coupon code is not valid.',
  inactive: 'This coupon is not active.',
  not_started: 'This coupon is not valid yet.',
  expired: 'This coupon has expired.',
  usage_limit_reached: 'This coupon has reached its usage limit.',
  customer_limit_reached:
    'You have already used this coupon the maximum number of times.',
  no_eligible_items: 'This coupon does not apply to the items in your bag.',
  minimum_not_met: 'Your bag does not meet the minimum order for this coupon.',
}

const fail = (reason: CouponFailure): CouponResult => ({
  valid: false,
  reason,
  message: MESSAGES[reason],
})

export function normaliseCode(code: string): string {
  return code.trim().toUpperCase()
}

function assertLines(lines: readonly CartLine[]) {
  for (const line of lines) {
    if (!Number.isInteger(line.unitPricePaise) || line.unitPricePaise < 0) {
      throw new TypeError('unitPricePaise must be a non-negative integer')
    }
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new TypeError('quantity must be a positive integer')
    }
  }
}

function isEligible(coupon: CouponRule, line: CartLine): boolean {
  const products = coupon.eligibleProductIds ?? []
  const collections = coupon.eligibleCollectionIds ?? []
  if (products.length === 0 && collections.length === 0) return true
  return (
    products.includes(line.productId) ||
    (line.collectionIds ?? []).some((id) => collections.includes(id))
  )
}

// Splits `total` across `weights` so the parts are whole paise and sum exactly
// (largest-remainder method).
function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  if (sum === 0 || total === 0) return weights.map(() => 0)
  const base = weights.map((w) => Math.floor((total * w) / sum))
  let remainder = total - base.reduce((a, b) => a + b, 0)
  const order = weights
    .map((w, index) => ({ index, frac: (total * w) % sum }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index)
  for (const { index } of order) {
    if (remainder === 0) break
    if (weights[index] > 0) {
      base[index] += 1
      remainder -= 1
    }
  }
  return base
}

/**
 * Validates a coupon against a bag and calculates the discount.
 * Business failures are returned as `{ valid: false }`; malformed input throws.
 * Money is integer paise; percent discounts round down.
 */
export function applyCoupon(
  coupon: CouponRule | null | undefined,
  lines: readonly CartLine[],
  context: CouponContext,
  code?: string,
): CouponResult {
  assertLines(lines)
  if (
    !coupon ||
    (code !== undefined && normaliseCode(code) !== normaliseCode(coupon.code))
  ) {
    return fail('invalid_code')
  }
  if (!coupon.active) return fail('inactive')
  if (coupon.validFrom && context.now < coupon.validFrom)
    return fail('not_started')
  if (coupon.validTo && context.now > coupon.validTo) return fail('expired')
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return fail('usage_limit_reached')
  }
  if (
    coupon.perCustomerLimit != null &&
    (context.customerRedemptions ?? 0) >= coupon.perCustomerLimit
  ) {
    return fail('customer_limit_reached')
  }

  const lineTotals = lines.map((line) =>
    isEligible(coupon, line) ? line.unitPricePaise * line.quantity : 0,
  )
  const eligibleSubtotalPaise = lineTotals.reduce((a, b) => a + b, 0)
  const hasEligibleLine = lines.some((line) => isEligible(coupon, line))
  if (!hasEligibleLine || eligibleSubtotalPaise === 0)
    return fail('no_eligible_items')
  if (
    coupon.minOrderPaise != null &&
    eligibleSubtotalPaise < coupon.minOrderPaise
  ) {
    return fail('minimum_not_met')
  }

  let discountPaise =
    coupon.type === 'percent'
      ? Math.floor((eligibleSubtotalPaise * coupon.value) / 100)
      : coupon.value
  if (coupon.type === 'percent' && coupon.maxDiscountPaise != null) {
    discountPaise = Math.min(discountPaise, coupon.maxDiscountPaise)
  }
  discountPaise = Math.min(discountPaise, eligibleSubtotalPaise)

  return {
    valid: true,
    code: normaliseCode(coupon.code),
    discountPaise,
    eligibleSubtotalPaise,
    lineDiscountsPaise: allocate(discountPaise, lineTotals),
  }
}

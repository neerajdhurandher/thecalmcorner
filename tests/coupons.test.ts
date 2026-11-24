import { describe, expect, it } from 'vitest'
import {
  applyCoupon,
  type CartLine,
  type CouponRule,
} from '../src/commerce/coupons'

const now = new Date('2026-12-01T10:00:00Z')
const base: CouponRule = {
  code: 'WELCOME10',
  active: true,
  type: 'percent',
  value: 10,
  usedCount: 0,
}
const lines: CartLine[] = [
  { productId: '1', collectionIds: ['10'], unitPricePaise: 49900, quantity: 2 },
  { productId: '2', collectionIds: ['20'], unitPricePaise: 10000, quantity: 1 },
]
const run = (
  coupon: Partial<CouponRule>,
  cart = lines,
  ctx = {},
  code?: string,
) => applyCoupon({ ...base, ...coupon }, cart, { now, ...ctx }, code)

describe('coupon validation', () => {
  it('rejects unknown, mismatched and inactive coupons', () => {
    expect(applyCoupon(null, lines, { now })).toMatchObject({
      reason: 'invalid_code',
    })
    expect(run({}, lines, {}, 'OTHER')).toMatchObject({
      reason: 'invalid_code',
    })
    expect(run({}, lines, {}, ' welcome10 ')).toMatchObject({ valid: true })
    expect(run({ active: false })).toMatchObject({ reason: 'inactive' })
  })

  it('enforces the validity window inclusively', () => {
    const from = new Date('2026-12-01T10:00:00Z')
    expect(run({ validFrom: new Date('2026-12-02T00:00:00Z') })).toMatchObject({
      reason: 'not_started',
    })
    expect(run({ validFrom: from, validTo: now })).toMatchObject({
      valid: true,
    })
    expect(run({ validTo: new Date('2026-11-30T00:00:00Z') })).toMatchObject({
      reason: 'expired',
    })
  })

  it('enforces total and per-customer usage limits', () => {
    expect(run({ usageLimit: 5, usedCount: 4 })).toMatchObject({ valid: true })
    expect(run({ usageLimit: 5, usedCount: 5 })).toMatchObject({
      reason: 'usage_limit_reached',
    })
    expect(
      run({ perCustomerLimit: 1 }, lines, { customerRedemptions: 0 }),
    ).toMatchObject({ valid: true })
    expect(
      run({ perCustomerLimit: 1 }, lines, { customerRedemptions: 1 }),
    ).toMatchObject({ reason: 'customer_limit_reached' })
  })

  it('applies the minimum order to the eligible subtotal', () => {
    expect(run({ minOrderPaise: 109800 })).toMatchObject({ valid: true })
    expect(run({ minOrderPaise: 109801 })).toMatchObject({
      reason: 'minimum_not_met',
    })
    const scoped = run({ minOrderPaise: 100000, eligibleProductIds: ['2'] })
    expect(scoped).toMatchObject({ reason: 'minimum_not_met' })
  })

  it('limits discounts to eligible products or collections', () => {
    const byProduct = run({ eligibleProductIds: ['2'] })
    expect(byProduct).toMatchObject({
      valid: true,
      eligibleSubtotalPaise: 10000,
      discountPaise: 1000,
    })
    const byCollection = run({ eligibleCollectionIds: ['10'] })
    expect(byCollection).toMatchObject({
      valid: true,
      eligibleSubtotalPaise: 99800,
    })
    expect(run({ eligibleProductIds: ['99'] })).toMatchObject({
      reason: 'no_eligible_items',
    })
  })
})

describe('discount calculation', () => {
  it('rounds percent discounts down and honours the cap', () => {
    const odd = [{ productId: '1', unitPricePaise: 999, quantity: 1 }]
    expect(run({ value: 15 }, odd)).toMatchObject({ discountPaise: 149 })
    expect(run({ value: 50, maxDiscountPaise: 5000 })).toMatchObject({
      discountPaise: 5000,
    })
  })

  it('never discounts more than the eligible subtotal', () => {
    expect(run({ type: 'fixed', value: 500000 })).toMatchObject({
      discountPaise: 109800,
    })
    expect(
      run({ type: 'fixed', value: 20000, eligibleProductIds: ['2'] }),
    ).toMatchObject({ discountPaise: 10000 })
  })

  it('allocates the discount across lines without losing paise', () => {
    const cart: CartLine[] = [1, 2, 3].map((n) => ({
      productId: String(n),
      unitPricePaise: 3333,
      quantity: 1,
    }))
    const result = run({ type: 'fixed', value: 100 }, cart)
    if (!result.valid) throw new Error('expected valid')
    expect(result.lineDiscountsPaise.reduce((a, b) => a + b, 0)).toBe(100)
    expect(result.lineDiscountsPaise.every(Number.isInteger)).toBe(true)
  })

  it('rejects malformed lines instead of guessing', () => {
    expect(() =>
      run({}, [{ productId: '1', unitPricePaise: 10.5, quantity: 1 }]),
    ).toThrow(TypeError)
    expect(() =>
      run({}, [{ productId: '1', unitPricePaise: 100, quantity: 0 }]),
    ).toThrow(TypeError)
  })

  it('treats an empty bag as having no eligible items', () => {
    expect(run({}, [])).toMatchObject({ reason: 'no_eligible_items' })
  })
})

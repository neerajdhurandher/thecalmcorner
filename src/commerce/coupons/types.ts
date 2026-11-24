export type CouponType = 'percent' | 'fixed'

export type CouponRule = {
  code: string
  active: boolean
  type: CouponType
  /** Percent (1–100) or fixed amount in paise. */
  value: number
  /** Optional cap on a percent discount, in paise. */
  maxDiscountPaise?: number | null
  /** Minimum subtotal of the eligible items, in paise. */
  minOrderPaise?: number | null
  validFrom?: Date | null
  validTo?: Date | null
  usageLimit?: number | null
  usedCount: number
  perCustomerLimit?: number | null
  /** Empty/omitted lists mean "all products". */
  eligibleProductIds?: readonly string[]
  eligibleCollectionIds?: readonly string[]
}

export type CartLine = {
  productId: string
  collectionIds?: readonly string[]
  unitPricePaise: number
  quantity: number
}

export type CouponContext = {
  now: Date
  /** Times this customer has already redeemed the coupon. */
  customerRedemptions?: number
}

export type CouponFailure =
  | 'invalid_code'
  | 'inactive'
  | 'not_started'
  | 'expired'
  | 'usage_limit_reached'
  | 'customer_limit_reached'
  | 'no_eligible_items'
  | 'minimum_not_met'

export type CouponResult =
  | {
      valid: true
      code: string
      discountPaise: number
      eligibleSubtotalPaise: number
      /** Discount allocated to each input line; sums to discountPaise. */
      lineDiscountsPaise: number[]
    }
  | { valid: false; reason: CouponFailure; message: string }

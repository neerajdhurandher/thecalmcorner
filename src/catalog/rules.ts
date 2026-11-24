export const PRODUCT_TYPES = [
  'live_plant',
  'artificial_plant',
  'candle',
  'bundle',
] as const
export type ProductType = (typeof PRODUCT_TYPES)[number]

export const SHIPPING_CLASSES = [
  'live_plant_bengaluru',
  'standard',
  'candle_protective',
] as const
export type ShippingClass = (typeof SHIPPING_CLASSES)[number]

export const PRODUCT_STATUSES = ['draft', 'published', 'archived'] as const

export const LIGHT_LEVELS = [
  'low_light',
  'indirect_sun',
  'bright_light',
] as const
export const WATER_LEVELS = ['low', 'moderate', 'high'] as const
export const DIFFICULTY_LEVELS = ['easy', 'moderate', 'expert'] as const
export const BADGES = [
  'handcrafted',
  'local_transit',
  'pure_soy',
  'live_plant',
  'lifelike',
  'zero_care',
  'signature_ritual_pair',
] as const

const REQUIRED_CLASS: Record<ProductType, ShippingClass | null> = {
  live_plant: 'live_plant_bengaluru',
  artificial_plant: 'standard',
  candle: 'candle_protective',
  // A bundle ships with its most restrictive component, chosen by staff.
  bundle: null,
}

export function shippingClassError(
  type: string | null | undefined,
  shippingClass: string | null | undefined,
): string | null {
  if (!type || !shippingClass) return null
  const required = REQUIRED_CLASS[type as ProductType]
  if (required === undefined) return null
  if (required && shippingClass !== required) {
    return `${type.replace('_', ' ')} products must use the "${required}" shipping class.`
  }
  return null
}

export const SKU_PATTERN = /^[A-Z0-9][A-Z0-9._-]{1,39}$/

export function normaliseTag(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

export const PINCODE_PATTERN = /^[1-9][0-9]{5}$/

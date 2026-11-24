import type { Field, NumberField } from 'payload'

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function slugField(): Field {
  return {
    name: 'slug',
    type: 'text',
    required: true,
    unique: true,
    index: true,
    admin: {
      description: 'URL handle: lowercase letters, numbers and hyphens only.',
    },
    validate: (value: string | null | undefined) =>
      value && SLUG_PATTERN.test(value)
        ? true
        : 'Use lowercase letters, numbers and single hyphens (e.g. "calm-duo").',
  }
}

type SingleNumberField = Extract<NumberField, { hasMany?: false }>

export function integerField(
  name: string,
  options: Partial<SingleNumberField> = {},
): SingleNumberField {
  const { min = 0, validate: extra, ...rest } = options
  return {
    ...rest,
    name,
    type: 'number',
    min,
    validate: async (value, args) => {
      if (value == null) {
        if (args.required) return 'This field is required.'
      } else if (!Number.isInteger(value)) {
        return 'Enter a whole number.'
      } else if (value < min) {
        return `Must be at least ${min}.`
      }
      return extra ? extra(value, args) : true
    },
  }
}

// Money is stored as integer paise (₹1 = 100 paise); prices are final selling prices.
export function paiseField(
  name: string,
  options: Partial<SingleNumberField> = {},
): SingleNumberField {
  return integerField(name, {
    ...options,
    admin: {
      description: 'Amount in paise (₹1 = 100 paise), e.g. 49900 for ₹499.',
      ...options.admin,
    },
  })
}

export const seoFields: Field = {
  name: 'seo',
  type: 'group',
  label: 'SEO',
  fields: [
    { name: 'metaTitle', type: 'text', maxLength: 70 },
    { name: 'metaDescription', type: 'textarea', maxLength: 160 },
    { name: 'ogImage', type: 'upload', relationTo: 'media' },
  ],
}

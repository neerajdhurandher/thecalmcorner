import type { CollectionConfig, Where } from 'payload'
import { isOwner, manageCatalog } from '../access/roles'
import { refreshMinPrice } from '../catalog/minPrice'
import { SKU_PATTERN, normaliseTag } from '../catalog/rules'
import { integerField, paiseField } from '../fields/common'
import { writeAudit } from '../hooks/audit'

const productId = (value: unknown) =>
  value && typeof value === 'object' && 'id' in value
    ? (value as { id: number }).id
    : (value as number | undefined)

export const Variants: CollectionConfig = {
  slug: 'variants',
  admin: {
    group: 'Catalog',
    useAsTitle: 'sku',
    defaultColumns: [
      'sku',
      'product',
      'finish',
      'scent',
      'pricePaise',
      'active',
    ],
    listSearchableFields: ['sku', 'size', 'finish', 'scent'],
  },
  access: {
    read: ({ req }): boolean | Where =>
      req.user?.collection === 'users'
        ? true
        : {
            and: [
              { active: { equals: true } },
              { 'product.status': { equals: 'published' } },
            ] as Where[],
          },
    create: manageCatalog,
    update: manageCatalog,
    delete: isOwner,
  },
  fields: [
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      index: true,
    },
    {
      name: 'sku',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Uppercase letters, numbers, ".", "_" or "-".' },
      hooks: {
        beforeValidate: [
          ({ value }) =>
            typeof value === 'string' ? value.trim().toUpperCase() : value,
        ],
      },
      validate: (value: string | null | undefined) =>
        value && SKU_PATTERN.test(value)
          ? true
          : 'SKU must be 2–40 characters: A–Z, 0–9, ".", "_" or "-".',
    },
    { name: 'size', type: 'text' },
    {
      name: 'finish',
      type: 'text',
      index: true,
      admin: {
        description: 'Planter/vessel finish, e.g. "speckled sandstone".',
      },
      hooks: {
        beforeValidate: [
          ({ value }) =>
            typeof value === 'string' ? normaliseTag(value) : value,
        ],
      },
    },
    {
      name: 'scent',
      type: 'text',
      hooks: {
        beforeValidate: [
          ({ value }) =>
            typeof value === 'string' ? normaliseTag(value) : value,
        ],
      },
    },
    paiseField('pricePaise', {
      required: true,
      admin: {
        description:
          'Final selling price in paise (₹1 = 100 paise); no GST is calculated.',
      },
    }),
    paiseField('compareAtPaise', {
      admin: { description: 'Original/MRP price in paise; must be ≥ price.' },
      validate: (
        value: number | null | undefined,
        { siblingData }: { siblingData: Record<string, unknown> },
      ) => {
        if (value == null) return true
        if (!Number.isInteger(value) || value < 0)
          return 'Enter a whole number.'
        const price = siblingData?.pricePaise
        return typeof price === 'number' && value < price
          ? 'Compare-at price must be at least the selling price.'
          : true
      },
    }),
    integerField('weightG', { admin: { description: 'Weight in grams.' } }),
    {
      name: 'dimensions',
      type: 'group',
      fields: [
        { name: 'lengthCm', type: 'number', min: 0 },
        { name: 'widthCm', type: 'number', min: 0 },
        { name: 'heightCm', type: 'number', min: 0 },
      ],
    },
    { name: 'active', type: 'checkbox', defaultValue: true, index: true },
  ],
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        const ids = new Set([
          productId(doc.product),
          productId(previousDoc?.product),
        ])
        for (const id of ids) {
          if (id != null) await refreshMinPrice(req, id)
        }
        await writeAudit(req, operation, 'variants', doc.id)
        return doc
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        const id = productId(doc.product)
        if (id != null) await refreshMinPrice(req, id)
        await writeAudit(req, 'delete', 'variants', doc.id)
        return doc
      },
    ],
  },
}

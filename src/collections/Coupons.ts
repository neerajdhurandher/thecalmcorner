import type { CollectionConfig } from 'payload'
import { isOwner, manageCoupons, readOperations } from '../access/roles'
import { normaliseCode } from '../commerce/coupons/validate'
import { integerField, paiseField } from '../fields/common'
import { auditChange, auditDelete } from '../hooks/audit'

const never = () => false

export const Coupons: CollectionConfig = {
  slug: 'coupons',
  admin: {
    group: 'Sales',
    useAsTitle: 'code',
    defaultColumns: ['code', 'type', 'value', 'active', 'validTo', 'usedCount'],
    listSearchableFields: ['code', 'description'],
  },
  access: {
    read: readOperations,
    create: manageCoupons,
    update: manageCoupons,
    delete: isOwner,
  },
  fields: [
    {
      name: 'code',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Letters, numbers, "-" and "_" (3–32); stored uppercase.',
      },
      hooks: {
        beforeValidate: [
          ({ value }) =>
            typeof value === 'string' ? normaliseCode(value) : value,
        ],
      },
      validate: (value: string | null | undefined) =>
        value && /^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(value)
          ? true
          : 'Use 3–32 letters, numbers, "-" or "_".',
    },
    { name: 'description', type: 'text' },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: { description: 'Deactivate to stop a coupon immediately.' },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'percent',
      options: [
        { value: 'percent', label: 'Percent off' },
        { value: 'fixed', label: 'Fixed amount off' },
      ],
    },
    integerField('value', {
      required: true,
      min: 1,
      admin: {
        description: 'Percent (1–100) or, for fixed, an amount in paise.',
      },
      validate: (
        value: number | null | undefined,
        { siblingData }: { siblingData: Record<string, unknown> },
      ) => {
        if (!Number.isInteger(value) || (value as number) < 1) {
          return 'Enter a whole number of at least 1.'
        }
        return siblingData?.type === 'percent' && (value as number) > 100
          ? 'A percent discount cannot exceed 100.'
          : true
      },
    }),
    paiseField('maxDiscountPaise', {
      admin: {
        description: 'Optional cap for percent coupons, in paise.',
        condition: (data) => data?.type === 'percent',
      },
    }),
    paiseField('minOrderPaise', {
      defaultValue: 0,
      admin: { description: 'Minimum subtotal of eligible items, in paise.' },
    }),
    {
      type: 'row',
      fields: [
        {
          name: 'validFrom',
          type: 'date',
          admin: { date: { pickerAppearance: 'dayAndTime' } },
        },
        {
          name: 'validTo',
          type: 'date',
          admin: { date: { pickerAppearance: 'dayAndTime' } },
          validate: (
            value: string | Date | null | undefined,
            { siblingData }: { siblingData: Record<string, unknown> },
          ) => {
            const from = siblingData?.validFrom
            if (value && from && new Date(value) < new Date(String(from))) {
              return 'End date must be after the start date.'
            }
            return true
          },
        },
      ],
    },
    integerField('usageLimit', {
      min: 1,
      admin: {
        description: 'Total redemptions allowed. Leave empty for unlimited.',
      },
    }),
    integerField('perCustomerLimit', {
      min: 1,
      admin: {
        description: 'Redemptions per customer. Leave empty for unlimited.',
      },
    }),
    integerField('usedCount', {
      defaultValue: 0,
      access: { create: never, update: never },
      admin: { readOnly: true, description: 'Maintained by checkout.' },
    }),
    {
      name: 'eligibleProducts',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
      admin: {
        description: 'Leave both lists empty to apply to every product.',
      },
    },
    {
      name: 'eligibleCollections',
      type: 'relationship',
      relationTo: 'product-collections',
      hasMany: true,
    },
  ],
  hooks: { afterChange: [auditChange], afterDelete: [auditDelete] },
}

import { ValidationError, type CollectionConfig } from 'payload'
import { manageStock, readStock } from '../access/roles'
import { applyStockAdjustment } from '../commerce/inventory/adjust'
import {
  ADJUSTMENT_REASONS,
  DEFAULT_LOCATION,
  NOTE_REQUIRED,
  type AdjustmentReason,
} from '../commerce/inventory/stock'
import { auditChange } from '../hooks/audit'

const never = () => false
const system = { readOnly: true }

export const StockAdjustments: CollectionConfig = {
  slug: 'stock-adjustments',
  admin: {
    group: 'Inventory',
    useAsTitle: 'reason',
    defaultColumns: ['createdAt', 'variant', 'delta', 'reason', 'newOnHand'],
    description:
      'Add or remove stock here. Entries are permanent; fix mistakes with a new adjustment.',
  },
  access: {
    read: readStock,
    create: manageStock,
    // Append-only ledger.
    update: never,
    delete: never,
  },
  fields: [
    {
      name: 'variant',
      type: 'relationship',
      relationTo: 'variants',
      required: true,
      index: true,
    },
    {
      name: 'location',
      type: 'text',
      required: true,
      defaultValue: DEFAULT_LOCATION,
    },
    {
      name: 'delta',
      type: 'number',
      required: true,
      admin: {
        description: 'Units to add (positive) or remove (negative).',
      },
      validate: (value: number | null | undefined) =>
        Number.isInteger(value) && value !== 0
          ? true
          : 'Enter a non-zero whole number.',
    },
    {
      name: 'reason',
      type: 'select',
      required: true,
      options: ADJUSTMENT_REASONS.map((value) => ({
        value,
        label: value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
      })),
    },
    {
      name: 'note',
      type: 'textarea',
      admin: { description: 'Required for loss, correction and other.' },
    },
    {
      name: 'stockLevel',
      type: 'relationship',
      relationTo: 'stock-levels',
      admin: system,
    },
    { name: 'previousOnHand', type: 'number', admin: system },
    { name: 'newOnHand', type: 'number', admin: system },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req }) => {
        const reason = data.reason as AdjustmentReason
        if (NOTE_REQUIRED.includes(reason) && !data.note?.trim()) {
          throw new ValidationError({
            collection: 'stock-adjustments',
            errors: [
              {
                path: 'note',
                message: 'Add a note explaining this adjustment.',
              },
            ],
          })
        }
        const result = await applyStockAdjustment(req, {
          variantId: data.variant,
          location: data.location,
          delta: data.delta,
        })
        // System-owned fields are always overwritten, never trusted from input.
        return {
          ...data,
          stockLevel: result.stockLevelId,
          previousOnHand: result.previousOnHand,
          newOnHand: result.newOnHand,
        }
      },
    ],
    afterChange: [auditChange],
  },
}

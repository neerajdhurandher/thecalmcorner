import type { CollectionConfig } from 'payload'
import { isOwner, manageStock, readStock } from '../access/roles'
import {
  DEFAULT_LOCATION,
  DEFAULT_LOW_STOCK_THRESHOLD,
  stockFigures,
} from '../commerce/inventory/stock'
import { integerField } from '../fields/common'
import { auditChange, auditDelete } from '../hooks/audit'

const never = () => false
const derived = { readOnly: true }

export const StockLevels: CollectionConfig = {
  slug: 'stock-levels',
  admin: {
    group: 'Inventory',
    useAsTitle: 'id',
    defaultColumns: [
      'variant',
      'location',
      'onHand',
      'reserved',
      'available',
      'lowStockThreshold',
      'isLowStock',
    ],
    description:
      'Quantities change only through Stock adjustments (with a reason). You can edit the low-stock threshold here.',
  },
  access: {
    read: readStock,
    // Rows are created and quantities changed by the system via stock adjustments.
    create: never,
    update: manageStock,
    delete: isOwner,
  },
  indexes: [{ fields: ['variant', 'location'], unique: true }],
  fields: [
    {
      name: 'variant',
      type: 'relationship',
      relationTo: 'variants',
      required: true,
      index: true,
      access: { update: never },
    },
    {
      name: 'location',
      type: 'text',
      required: true,
      defaultValue: DEFAULT_LOCATION,
      access: { update: never },
    },
    integerField('onHand', {
      required: true,
      defaultValue: 0,
      admin: derived,
      access: { update: never },
    }),
    integerField('reserved', {
      required: true,
      defaultValue: 0,
      admin: derived,
      access: { update: never },
    }),
    integerField('available', {
      required: true,
      defaultValue: 0,
      admin: derived,
      access: { update: never },
    }),
    integerField('lowStockThreshold', {
      required: true,
      defaultValue: DEFAULT_LOW_STOCK_THRESHOLD,
    }),
    {
      name: 'isLowStock',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: derived,
      access: { update: never },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        const onHand = data.onHand ?? originalDoc?.onHand ?? 0
        const reserved = data.reserved ?? originalDoc?.reserved ?? 0
        const threshold =
          data.lowStockThreshold ??
          originalDoc?.lowStockThreshold ??
          DEFAULT_LOW_STOCK_THRESHOLD
        return { ...data, ...stockFigures({ onHand, reserved }, threshold) }
      },
    ],
    afterChange: [auditChange],
    afterDelete: [auditDelete],
  },
}

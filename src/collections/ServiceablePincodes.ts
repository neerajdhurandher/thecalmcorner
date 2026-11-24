import type { CollectionConfig } from 'payload'
import { isOwner, isStaff, managePincodes } from '../access/roles'
import { PINCODE_PATTERN } from '../catalog/rules'
import { PINCODE_TEMPLATE, importPincodes } from '../catalog/importPincodes'
import { csvImportEndpoints } from '../endpoints/csvImport'
import { integerField } from '../fields/common'
import { auditChange, auditDelete } from '../hooks/audit'

export const ServiceablePincodes: CollectionConfig = {
  slug: 'serviceable-pincodes',
  labels: { singular: 'Serviceable PIN code', plural: 'Serviceable PIN codes' },
  admin: {
    group: 'Delivery',
    useAsTitle: 'pincode',
    defaultColumns: [
      'pincode',
      'area',
      'city',
      'etaMinDays',
      'etaMaxDays',
      'enabled',
    ],
    listSearchableFields: ['pincode', 'area', 'city'],
    description:
      'Live plants can be ordered only for enabled PIN codes in this list. Other products ship PAN India.',
    components: {
      beforeList: [
        {
          path: '/components/admin/CsvImport#CsvImport',
          clientProps: {
            endpoint: '/api/serviceable-pincodes/import',
            title: 'Bulk import PIN codes',
            templateHref: '/api/serviceable-pincodes/import-template',
          },
        },
      ],
    },
  },
  endpoints: csvImportEndpoints(
    (req, text, apply) => importPincodes(req.payload, req.user, text, apply),
    PINCODE_TEMPLATE,
    'pincodes-template.csv',
  ),
  access: {
    read: isStaff,
    create: managePincodes,
    update: managePincodes,
    delete: isOwner,
  },
  fields: [
    {
      name: 'pincode',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      validate: (value: string | null | undefined) =>
        value && PINCODE_PATTERN.test(value)
          ? true
          : 'Enter a valid 6-digit Indian PIN code.',
    },
    { name: 'area', type: 'text' },
    { name: 'city', type: 'text', required: true, defaultValue: 'Bengaluru' },
    { name: 'state', type: 'text', defaultValue: 'Karnataka' },
    integerField('etaMinDays', {
      defaultValue: 0,
      admin: { description: 'Earliest delivery, in days (0 = same day).' },
    }),
    integerField('etaMaxDays', {
      defaultValue: 1,
      validate: (
        value: number | null | undefined,
        { siblingData }: { siblingData: Record<string, unknown> },
      ) => {
        if (!Number.isInteger(value) || (value as number) < 0)
          return 'Enter a whole number.'
        const min = siblingData?.etaMinDays
        return typeof min === 'number' && (value as number) < min
          ? 'Latest ETA cannot be earlier than the earliest ETA.'
          : true
      },
    }),
    { name: 'enabled', type: 'checkbox', defaultValue: true, index: true },
  ],
  hooks: { afterChange: [auditChange], afterDelete: [auditDelete] },
}

import { ValidationError, type CollectionConfig } from 'payload'
import { manageCatalog, readPublishedCatalog, isOwner } from '../access/roles'
import {
  BADGES,
  DIFFICULTY_LEVELS,
  LIGHT_LEVELS,
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
  SHIPPING_CLASSES,
  normaliseTag,
  shippingClassError,
} from '../catalog/rules'
import {
  integerField,
  paiseField,
  seoFields,
  slugField,
} from '../fields/common'
import { auditChange, auditDelete } from '../hooks/audit'
import { CATALOG_TEMPLATE, importCatalog } from '../catalog/importCatalog'
import { csvImportEndpoints } from '../endpoints/csvImport'
import { searchEndpoint } from '../endpoints/search'

const options = (values: readonly string[]) =>
  values.map((value) => ({
    value,
    label: value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
  }))

const normaliseTags = (value: unknown) =>
  Array.isArray(value)
    ? [
        ...new Set(
          value.map((tag) => normaliseTag(String(tag))).filter(Boolean),
        ),
      ]
    : value

export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    group: 'Catalog',
    useAsTitle: 'title',
    defaultColumns: ['title', 'type', 'status', 'shippingClass', 'updatedAt'],
    listSearchableFields: ['title', 'slug'],
    components: {
      beforeList: [
        {
          path: '/components/admin/CsvImport#CsvImport',
          clientProps: {
            endpoint: '/api/products/import',
            title: 'Import catalog (products, variants, opening stock)',
            templateHref: '/api/products/import-template',
          },
        },
      ],
    },
  },
  endpoints: [
    ...csvImportEndpoints(
      (req, text, apply) => importCatalog(req.payload, req.user, text, apply),
      CATALOG_TEMPLATE,
      'catalog-template.csv',
    ),
    searchEndpoint,
  ],
  access: {
    read: readPublishedCatalog,
    create: manageCatalog,
    update: manageCatalog,
    delete: isOwner,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    slugField(),
    {
      name: 'type',
      type: 'select',
      required: true,
      options: options(PRODUCT_TYPES),
      index: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      index: true,
      options: options(PRODUCT_STATUSES),
      admin: {
        description:
          'Publishing needs a description, at least one image and one active variant. Use Archived instead of deleting.',
      },
    },
    {
      name: 'shippingClass',
      type: 'select',
      required: true,
      index: true,
      options: options(SHIPPING_CLASSES),
      admin: {
        description:
          'Live plants ship only to listed Bengaluru PIN codes; others ship PAN India.',
      },
      validate: (
        value: string | null | undefined,
        { siblingData }: { siblingData: Record<string, unknown> },
      ) => {
        if (!value) return 'Choose a shipping class.'
        return (
          shippingClassError(String(siblingData?.type ?? ''), value) ?? true
        )
      },
    },
    { name: 'description', type: 'textarea' },
    {
      name: 'images',
      type: 'array',
      labels: { singular: 'Image', plural: 'Images' },
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', required: true },
      ],
    },
    {
      name: 'badges',
      type: 'select',
      hasMany: true,
      options: options(BADGES),
    },
    {
      name: 'collections',
      type: 'relationship',
      relationTo: 'product-collections',
      hasMany: true,
    },
    { name: 'material', type: 'text' },
    {
      name: 'plantCare',
      type: 'group',
      admin: { condition: (data) => data?.type === 'live_plant' },
      fields: [
        {
          name: 'light',
          type: 'select',
          options: options(LIGHT_LEVELS),
          index: true,
        },
        {
          name: 'water',
          type: 'select',
          options: [
            { value: 'low', label: 'Low' },
            { value: 'moderate', label: 'Moderate' },
            { value: 'high', label: 'High' },
          ],
        },
        {
          name: 'difficulty',
          type: 'select',
          options: options(DIFFICULTY_LEVELS),
        },
        { name: 'petSafe', type: 'checkbox', defaultValue: false, index: true },
        { name: 'airPurifying', type: 'checkbox', defaultValue: false },
        { name: 'careGuide', type: 'relationship', relationTo: 'care-guides' },
      ],
    },
    {
      name: 'candleSpec',
      type: 'group',
      admin: { condition: (data) => data?.type === 'candle' },
      fields: [
        { name: 'waxType', type: 'text', defaultValue: 'Soy' },
        {
          name: 'aromaNotes',
          type: 'text',
          hasMany: true,
          admin: {
            description:
              'Filter tags such as "lavender fog" or "warm vanilla" (stored lowercase).',
          },
          hooks: { beforeValidate: [({ value }) => normaliseTags(value)] },
        },
        { name: 'scentTop', type: 'text' },
        { name: 'scentHeart', type: 'text' },
        { name: 'scentBase', type: 'text' },
        integerField('burnHours', { min: 1 }),
        { name: 'vessel', type: 'text' },
      ],
    },
    {
      name: 'searchKeywords',
      type: 'text',
      admin: { description: 'Extra words customers might search for.' },
    },
    paiseField('minPricePaise', {
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Lowest active variant price (updated automatically).',
      },
    }),
    seoFields,
  ],
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, operation, req }) => {
        const status = data.status ?? originalDoc?.status
        if (status !== 'published') return data
        const errors: { path: string; message: string }[] = []
        if (operation === 'create') {
          errors.push({
            path: 'status',
            message:
              'Save as draft first, add variants and images, then publish.',
          })
        } else {
          const description = data.description ?? originalDoc?.description
          const images = data.images ?? originalDoc?.images
          if (!description) {
            errors.push({ path: 'description', message: 'Add a description.' })
          }
          if (!Array.isArray(images) || images.length === 0) {
            errors.push({ path: 'images', message: 'Add at least one image.' })
          }
          const variants = await req.payload.count({
            collection: 'variants',
            where: {
              and: [
                { product: { equals: originalDoc?.id } },
                { active: { equals: true } },
              ],
            },
            req,
            overrideAccess: true,
          })
          if (variants.totalDocs === 0) {
            errors.push({
              path: 'status',
              message: 'Add at least one active variant before publishing.',
            })
          }
        }
        if (errors.length > 0) {
          throw new ValidationError({ collection: 'products', errors })
        }
        return data
      },
    ],
    afterChange: [auditChange],
    afterDelete: [auditDelete],
  },
}

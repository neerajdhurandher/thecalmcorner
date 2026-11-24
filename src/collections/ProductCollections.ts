import type { CollectionConfig } from 'payload'
import { isOwner, manageContent, readPublished } from '../access/roles'
import { integerField, seoFields, slugField } from '../fields/common'
import { auditChange, auditDelete } from '../hooks/audit'

export const ProductCollections: CollectionConfig = {
  slug: 'product-collections',
  labels: { singular: 'Collection', plural: 'Collections' },
  admin: {
    group: 'Catalog',
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'status', 'sortOrder'],
  },
  access: {
    read: readPublished,
    create: manageContent,
    update: manageContent,
    delete: isOwner,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    slugField(),
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      index: true,
      options: ['draft', 'published'],
    },
    { name: 'description', type: 'textarea' },
    { name: 'image', type: 'upload', relationTo: 'media' },
    integerField('sortOrder', { defaultValue: 0 }),
    seoFields,
  ],
  hooks: { afterChange: [auditChange], afterDelete: [auditDelete] },
}

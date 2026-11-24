import type { CollectionConfig } from 'payload'
import { isOwner, manageContent, readPublished } from '../access/roles'
import { seoFields, slugField } from '../fields/common'
import { auditChange, auditDelete } from '../hooks/audit'

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    group: 'Content',
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'status', 'updatedAt'],
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
    { name: 'content', type: 'richText' },
    seoFields,
  ],
  hooks: { afterChange: [auditChange], afterDelete: [auditDelete] },
}

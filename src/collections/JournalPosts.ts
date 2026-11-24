import type { CollectionConfig } from 'payload'
import { isOwner, manageContent, readPublished } from '../access/roles'
import { seoFields, slugField } from '../fields/common'
import { auditChange, auditDelete } from '../hooks/audit'

export const JournalPosts: CollectionConfig = {
  slug: 'journal-posts',
  labels: { singular: 'Journal post', plural: 'Journal posts' },
  admin: {
    group: 'Content',
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'status', 'publishedAt'],
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
    { name: 'excerpt', type: 'textarea', maxLength: 300 },
    { name: 'heroImage', type: 'upload', relationTo: 'media' },
    { name: 'content', type: 'richText' },
    {
      name: 'publishedAt',
      type: 'date',
      index: true,
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    { name: 'author', type: 'text' },
    seoFields,
  ],
  hooks: { afterChange: [auditChange], afterDelete: [auditDelete] },
}

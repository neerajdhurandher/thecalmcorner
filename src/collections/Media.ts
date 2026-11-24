import type { CollectionConfig } from 'payload'
import { manageContent } from '../access/roles'
import { auditChange, auditDelete } from '../hooks/audit'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: { group: 'Content' },
  access: {
    read: () => true,
    create: manageContent,
    update: manageContent,
    delete: manageContent,
  },
  upload: {
    staticDir: 'media',
    mimeTypes: ['image/*'],
  },
  fields: [{ name: 'alt', type: 'text', required: true }],
  hooks: { afterChange: [auditChange], afterDelete: [auditDelete] },
}

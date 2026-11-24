import type { CollectionConfig } from 'payload'
import { isOwner } from '../access/roles'

export const AuditLogs: CollectionConfig = {
  slug: 'audit-logs',
  admin: {
    useAsTitle: 'resource',
    defaultColumns: ['createdAt', 'actorId', 'action', 'resource', 'targetId'],
    group: 'Administration',
  },
  access: {
    read: isOwner,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'actorId', type: 'text', required: true },
    {
      name: 'action',
      type: 'select',
      required: true,
      options: ['create', 'update', 'delete', 'login'],
    },
    { name: 'resource', type: 'text', required: true },
    { name: 'targetId', type: 'text', required: true },
  ],
}

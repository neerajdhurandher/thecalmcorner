import type { GlobalConfig } from 'payload'
import { manageGlobals } from '../access/roles'
import { writeAudit } from '../hooks/audit'

export const StoreSettings: GlobalConfig = {
  slug: 'store-settings',
  access: { read: () => true, update: manageGlobals },
  fields: [
    {
      name: 'storeName',
      type: 'text',
      required: true,
      defaultValue: 'The Calm Corner',
    },
    { name: 'announcement', type: 'text' },
  ],
  hooks: {
    afterChange: [
      async ({ doc, req }) => {
        await writeAudit(req, 'update', 'store-settings', doc.id)
        return doc
      },
    ],
  },
}

import { ValidationError, type CollectionConfig } from 'payload'
import { isOwner, isOwnerField, readOwnUser } from '../access/roles'
import { auditChange, auditDelete, writeAudit } from '../hooks/audit'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: { group: 'Administration', useAsTitle: 'email' },
  auth: {
    tokenExpiration: 60 * 60,
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000,
    cookies: {
      sameSite: 'Lax',
      secure:
        process.env.SERVER_URL?.toLowerCase().startsWith('https://') ?? false,
    },
  },
  access: {
    admin: ({ req }) => req.user?.collection === 'users',
    create: isOwner,
    read: readOwnUser,
    update: readOwnUser,
    delete: isOwner,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'content',
      access: { create: isOwnerField, update: isOwnerField },
      options: ['owner', 'manager', 'fulfilment', 'support', 'content'],
    },
    {
      name: 'password',
      type: 'text',
      hidden: true,
      virtual: true,
    },
  ],
  hooks: {
    beforeOperation: [
      ({ operation, args }) => {
        if (
          operation === 'create' ||
          operation === 'update' ||
          operation === 'resetPassword'
        ) {
          const password = args.data?.password
          if (typeof password === 'string' && password.length < 12) {
            throw new ValidationError({
              collection: 'users',
              errors: [
                {
                  path: 'password',
                  message: 'Password must be at least 12 characters',
                },
              ],
            })
          }
        }
        return args
      },
    ],
    beforeValidate: [
      async ({ data, operation, req }) => {
        if (operation === 'create' && !req.user) {
          const { totalDocs } = await req.payload.count({
            collection: 'users',
            req,
            overrideAccess: true,
          })
          if (totalDocs === 0) return { ...data, role: 'owner' }
        }
        return data
      },
    ],
    afterChange: [auditChange],
    afterDelete: [auditDelete],
    afterLogin: [
      async ({ req, user }) => {
        await writeAudit(req, 'login', 'users', user.id, user.id)
        return user
      },
    ],
  },
}

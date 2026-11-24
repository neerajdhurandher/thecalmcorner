import type { CollectionConfig } from 'payload'
import { isOwner, manageCustomers, readOwnCustomer } from '../access/roles'
import { auditChange, auditDelete } from '../hooks/audit'

// Storefront customers are a separate auth collection from admin staff.
// Public sign-up and OTP login arrive with the account work in a later phase.
export const Customers: CollectionConfig = {
  slug: 'customers',
  admin: {
    group: 'Customers',
    useAsTitle: 'email',
    defaultColumns: ['name', 'email', 'phone', 'createdAt'],
    listSearchableFields: ['name', 'email', 'phone'],
  },
  auth: {
    tokenExpiration: 30 * 24 * 60 * 60,
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000,
    cookies: {
      sameSite: 'Lax',
      secure:
        process.env.SERVER_URL?.toLowerCase().startsWith('https://') ?? false,
    },
  },
  access: {
    admin: () => false,
    create: manageCustomers,
    read: readOwnCustomer,
    update: readOwnCustomer,
    delete: isOwner,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'phone',
      type: 'text',
      validate: (value: string | null | undefined) =>
        !value || /^\+?[0-9]{10,15}$/.test(value)
          ? true
          : 'Enter 10–15 digits, optionally starting with +.',
    },
    {
      name: 'consent',
      type: 'group',
      fields: [
        { name: 'marketingEmail', type: 'checkbox', defaultValue: false },
        { name: 'whatsapp', type: 'checkbox', defaultValue: false },
        { name: 'recordedAt', type: 'date' },
      ],
    },
    {
      name: 'addresses',
      type: 'array',
      fields: [
        { name: 'label', type: 'text' },
        { name: 'recipient', type: 'text', required: true },
        { name: 'phone', type: 'text', required: true },
        { name: 'line1', type: 'text', required: true },
        { name: 'line2', type: 'text' },
        { name: 'city', type: 'text', required: true },
        { name: 'state', type: 'text', required: true },
        {
          name: 'pincode',
          type: 'text',
          required: true,
          validate: (value: string | null | undefined) =>
            value && /^[1-9][0-9]{5}$/.test(value)
              ? true
              : 'Enter a valid 6-digit PIN code.',
        },
        { name: 'isDefault', type: 'checkbox', defaultValue: false },
      ],
    },
  ],
  hooks: { afterChange: [auditChange], afterDelete: [auditDelete] },
}

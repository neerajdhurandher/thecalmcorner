import type { Access, FieldAccess } from 'payload'

export type StaffRole =
  'owner' | 'manager' | 'fulfilment' | 'support' | 'content'

export function hasRole(
  user: { collection?: string; role?: string | null } | null,
  roles: StaffRole[],
) {
  return (
    user?.collection === 'users' && roles.some((role) => role === user.role)
  )
}

export const isOwner: Access = ({ req }) => hasRole(req.user, ['owner'])
export const isOwnerField: FieldAccess = ({ req }) =>
  hasRole(req.user, ['owner'])

export const isStaff: Access = ({ req }) =>
  hasRole(req.user, ['owner', 'manager', 'fulfilment', 'support', 'content'])

// Role matrix (owner > manager; fulfilment and support are read/ops roles):
// catalog, coupons, PIN codes: owner + manager; stock adjustments: + fulfilment;
// stock/coupon/PIN visibility: staff who need them to do their job.
export const manageCatalog: Access = ({ req }) =>
  hasRole(req.user, ['owner', 'manager'])
export const manageCoupons = manageCatalog
export const managePincodes = manageCatalog
export const manageStock: Access = ({ req }) =>
  hasRole(req.user, ['owner', 'manager', 'fulfilment'])
export const readStock: Access = ({ req }) =>
  hasRole(req.user, ['owner', 'manager', 'fulfilment', 'support'])
export const readOperations: Access = ({ req }) =>
  hasRole(req.user, ['owner', 'manager', 'support'])
export const manageCustomers: Access = ({ req }) =>
  hasRole(req.user, ['owner', 'manager', 'support'])
export const manageContent: Access = ({ req }) =>
  hasRole(req.user, ['owner', 'manager', 'content'])
export const manageGlobals: Access = ({ req }) =>
  hasRole(req.user, ['owner', 'manager', 'content'])

export const readPublished: Access = ({ req }) =>
  hasRole(req.user, ['owner', 'manager', 'content'])
    ? true
    : { status: { equals: 'published' } }

export const readOwnUser: Access = ({ req }) => {
  if (hasRole(req.user, ['owner'])) return true
  if (req.user?.collection === 'users') return { id: { equals: req.user.id } }
  return false
}

// Public sees published records; catalog/content editors see everything.
export const readPublishedCatalog: Access = ({ req }) =>
  hasRole(req.user, ['owner', 'manager', 'content', 'fulfilment', 'support'])
    ? true
    : { status: { equals: 'published' } }

export const readOwnCustomer: Access = ({ req }) => {
  if (hasRole(req.user, ['owner', 'manager', 'support'])) return true
  if (req.user?.collection === 'customers')
    return { id: { equals: req.user.id } }
  return false
}

import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  PayloadRequest,
} from 'payload'

async function writeAudit(
  req: PayloadRequest,
  action: 'create' | 'update' | 'delete' | 'login',
  collection: string,
  targetId: number | string,
  actorId?: number | string,
) {
  await req.payload.create({
    collection: 'audit-logs',
    data: {
      action,
      resource: collection,
      targetId: String(targetId),
      actorId:
        actorId == null
          ? req.user
            ? String(req.user.id)
            : 'system'
          : String(actorId),
    },
    req,
    overrideAccess: true,
  })
}

// Fields maintained by the system; an update touching only these is not logged.
const DERIVED_KEYS = new Set([
  'updatedAt',
  'minPricePaise',
  'onHand',
  'reserved',
  'available',
  'isLowStock',
])

function onlyDerivedChanged(
  doc: Record<string, unknown>,
  previous: Record<string, unknown> | undefined,
) {
  if (!previous) return false
  return Object.keys(doc).every(
    (key) =>
      DERIVED_KEYS.has(key) ||
      JSON.stringify(doc[key]) === JSON.stringify(previous[key]),
  )
}

export const auditChange: CollectionAfterChangeHook = async ({
  doc,
  operation,
  collection,
  req,
  previousDoc,
}) => {
  if (operation === 'update' && onlyDerivedChanged(doc, previousDoc)) return doc
  await writeAudit(req, operation, collection.slug, doc.id)
  return doc
}

export const auditDelete: CollectionAfterDeleteHook = async ({
  doc,
  collection,
  req,
}) => {
  await writeAudit(req, 'delete', collection.slug, doc.id)
  return doc
}

export { writeAudit }

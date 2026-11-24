import { sql } from '@payloadcms/db-postgres'
import { ValidationError, type PayloadRequest } from 'payload'
import {
  DEFAULT_LOCATION,
  DEFAULT_LOW_STOCK_THRESHOLD,
  StockError,
  applyAdjustment,
  stockFigures,
} from './stock'

type Db = { execute: (query: unknown) => Promise<unknown> }

// Uses the request's open transaction so the row lock lasts until commit.
function transactionDb(req: PayloadRequest): Db {
  const adapter = req.payload.db as unknown as {
    drizzle: Db
    sessions: Record<string, { db: Db }>
  }
  return (
    (req.transactionID && adapter.sessions[String(req.transactionID)]?.db) ||
    adapter.drizzle
  )
}

export async function ensureStockLevel(
  req: PayloadRequest,
  variantId: number | string,
  location = DEFAULT_LOCATION,
  lowStockThreshold?: number,
) {
  const { payload } = req
  const existing = await payload.find({
    collection: 'stock-levels',
    where: {
      and: [
        { variant: { equals: variantId } },
        { location: { equals: location } },
      ],
    },
    limit: 1,
    depth: 0,
    req,
    overrideAccess: true,
  })
  const found = existing.docs[0]
  if (found) {
    if (
      lowStockThreshold != null &&
      found.lowStockThreshold !== lowStockThreshold
    ) {
      return payload.update({
        collection: 'stock-levels',
        id: found.id,
        data: { lowStockThreshold },
        depth: 0,
        req,
        overrideAccess: true,
      })
    }
    return found
  }
  return payload.create({
    collection: 'stock-levels',
    data: {
      variant: Number(variantId),
      location,
      onHand: 0,
      reserved: 0,
      available: 0,
      isLowStock: true,
      lowStockThreshold: lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD,
    },
    depth: 0,
    req,
    overrideAccess: true,
  })
}

export async function applyStockAdjustment(
  req: PayloadRequest,
  input: { variantId: number | string; location?: string; delta: number },
) {
  const { payload } = req
  const level = await ensureStockLevel(req, input.variantId, input.location)
  // Serialise concurrent adjustments of the same stock row.
  await transactionDb(req).execute(
    sql`SELECT id FROM stock_levels WHERE id = ${level.id} FOR UPDATE`,
  )
  const current = await payload.findByID({
    collection: 'stock-levels',
    id: level.id,
    depth: 0,
    req,
    overrideAccess: true,
  })
  let next
  try {
    next = applyAdjustment(
      { onHand: current.onHand, reserved: current.reserved },
      input.delta,
    )
  } catch (error) {
    if (error instanceof StockError) {
      throw new ValidationError({
        collection: 'stock-adjustments',
        errors: [{ path: 'delta', message: error.message }],
      })
    }
    throw error
  }
  const figures = stockFigures(next, current.lowStockThreshold)
  await payload.update({
    collection: 'stock-levels',
    id: level.id,
    data: figures,
    depth: 0,
    req,
    overrideAccess: true,
  })
  return {
    stockLevelId: level.id,
    previousOnHand: current.onHand,
    newOnHand: next.onHand,
  }
}

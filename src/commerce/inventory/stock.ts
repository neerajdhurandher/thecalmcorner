export const DEFAULT_LOCATION = 'Bengaluru'
export const DEFAULT_LOW_STOCK_THRESHOLD = 5

export const ADJUSTMENT_REASONS = [
  'opening_stock',
  'restock',
  'damage',
  'loss',
  'correction',
  'return_to_stock',
  'other',
] as const
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number]

// Reasons whose cause is not self-explanatory must carry a note.
export const NOTE_REQUIRED: readonly AdjustmentReason[] = [
  'loss',
  'correction',
  'other',
]

export type StockFigures = { onHand: number; reserved: number }

export class StockError extends Error {}

export function stockFigures(
  { onHand, reserved }: StockFigures,
  lowStockThreshold: number,
) {
  const available = onHand - reserved
  return {
    onHand,
    reserved,
    available,
    isLowStock: available <= lowStockThreshold,
  }
}

// Pure rule: an adjustment may never take on-hand below what is reserved.
export function applyAdjustment(current: StockFigures, delta: number) {
  if (!Number.isInteger(delta) || delta === 0) {
    throw new StockError('Adjustment must be a non-zero whole number.')
  }
  const onHand = current.onHand + delta
  if (onHand < 0) {
    throw new StockError(
      `Cannot remove ${-delta}: only ${current.onHand} on hand.`,
    )
  }
  if (onHand < current.reserved) {
    throw new StockError(
      `Cannot reduce stock to ${onHand}: ${current.reserved} units are reserved by open orders.`,
    )
  }
  return { onHand, reserved: current.reserved }
}

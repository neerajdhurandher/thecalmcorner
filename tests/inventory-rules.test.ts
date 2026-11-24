import { describe, expect, it } from 'vitest'
import {
  StockError,
  applyAdjustment,
  stockFigures,
} from '../src/commerce/inventory/stock'

describe('stock rules', () => {
  it('adds and removes stock', () => {
    expect(applyAdjustment({ onHand: 5, reserved: 1 }, 3)).toEqual({
      onHand: 8,
      reserved: 1,
    })
    expect(applyAdjustment({ onHand: 5, reserved: 1 }, -4)).toEqual({
      onHand: 1,
      reserved: 1,
    })
  })

  it('refuses to go below zero or below reserved units', () => {
    expect(() => applyAdjustment({ onHand: 2, reserved: 0 }, -3)).toThrow(
      StockError,
    )
    expect(() => applyAdjustment({ onHand: 5, reserved: 4 }, -2)).toThrow(
      /reserved/,
    )
  })

  it('refuses zero and fractional adjustments', () => {
    expect(() => applyAdjustment({ onHand: 5, reserved: 0 }, 0)).toThrow(
      StockError,
    )
    expect(() => applyAdjustment({ onHand: 5, reserved: 0 }, 1.5)).toThrow(
      StockError,
    )
  })

  it('flags low stock at or below the threshold', () => {
    expect(stockFigures({ onHand: 8, reserved: 3 }, 5)).toMatchObject({
      available: 5,
      isLowStock: true,
    })
    expect(stockFigures({ onHand: 9, reserved: 3 }, 5)).toMatchObject({
      available: 6,
      isLowStock: false,
    })
  })
})

import { describe, expect, it } from 'vitest'
import { shippingClassError } from '../src/catalog/rules'
import {
  CATALOG_TEMPLATE,
  validateCatalogRows,
} from '../src/catalog/importCatalog'
import { validatePincodeRows } from '../src/catalog/importPincodes'
import { parseBoolean, rupeesToPaise } from '../src/lib/csv'
import { buildProductWhere } from '../src/search/products'

const HEADER =
  'product_slug,product_title,product_type,shipping_class,sku,price_inr,mrp_inr,opening_stock'
const csv = (...rows: string[]) => [HEADER, ...rows].join('\n')

describe('CSV helpers', () => {
  it('converts rupees to paise exactly', () => {
    expect(rupeesToPaise('499')).toBe(49900)
    expect(rupeesToPaise('499.5')).toBe(49950)
    expect(rupeesToPaise('0.07')).toBe(7)
    for (const bad of ['', '-1', '1.234', '₹5', '1,000', 'abc'])
      expect(rupeesToPaise(bad)).toBeNull()
  })

  it('parses yes/no values', () => {
    expect(parseBoolean('Yes')).toBe(true)
    expect(parseBoolean('0')).toBe(false)
    expect(parseBoolean('maybe')).toBeNull()
  })
})

describe('shipping class rule', () => {
  it('ties product types to shipping classes', () => {
    expect(shippingClassError('live_plant', 'standard')).toMatch(
      /live_plant_bengaluru/,
    )
    expect(shippingClassError('live_plant', 'live_plant_bengaluru')).toBeNull()
    expect(shippingClassError('candle', 'candle_protective')).toBeNull()
    expect(
      shippingClassError('artificial_plant', 'candle_protective'),
    ).not.toBeNull()
    expect(shippingClassError('bundle', 'standard')).toBeNull()
  })
})

describe('catalog CSV validation', () => {
  it('accepts the shipped template', () => {
    expect(validateCatalogRows(CATALOG_TEMPLATE).errors).toEqual([])
  })

  it('reports unknown or missing columns and empty files', () => {
    expect(
      validateCatalogRows('product_slug,oops\na,b')
        .errors.map((e) => e.message)
        .join(' '),
    ).toMatch(/Missing required column "sku".*Unknown column "oops"/)
    expect(validateCatalogRows(HEADER).errors[0].message).toMatch(
      /no data rows/,
    )
  })

  it('reports row-level problems with the row number', () => {
    const { errors } = validateCatalogRows(
      csv(
        'ok-plant,Ok,candle,candle_protective,OK-1,100,90,5',
        'bad-class,Bad,live_plant,standard,BAD-1,100,,',
        'bad-price,Price,candle,candle_protective,PRICE-1,1.234,,',
        'dupe,Dupe,candle,candle_protective,OK-1,100,,',
      ),
    )
    const byRow = (row: number) =>
      errors
        .filter((e) => e.row === row)
        .map((e) => e.message)
        .join(' ')
    expect(byRow(2)).toMatch(/mrp_inr must be at least price_inr/)
    expect(byRow(3)).toMatch(/live_plant_bengaluru/)
    expect(byRow(4)).toMatch(/price_inr/)
    expect(byRow(5)).toMatch(/also on row 2/)
  })

  it('requires rows of one product to agree', () => {
    const { errors } = validateCatalogRows(
      csv(
        'fern,Fern,live_plant,live_plant_bengaluru,F-1,100,,',
        'fern,Other title,live_plant,live_plant_bengaluru,F-2,100,,',
      ),
    )
    expect(errors).toEqual([
      {
        row: 3,
        message: 'product_title differs from row 2 for the same product.',
      },
    ])
  })

  it('normalises SKUs to uppercase', () => {
    const { rows, errors } = validateCatalogRows(
      csv('c,C,candle,candle_protective,cand-1,100,,'),
    )
    expect(errors).toEqual([])
    expect(rows[0].data.sku).toBe('CAND-1')
  })
})

describe('PIN code CSV validation', () => {
  it('accepts valid rows and applies defaults later', () => {
    const { entries, errors } = validatePincodeRows(
      'pincode,enabled\n560001,yes\n560002,no\n',
    )
    expect(errors).toEqual([])
    expect(entries.map((e) => [e.pincode, e.enabled])).toEqual([
      ['560001', true],
      ['560002', false],
    ])
  })

  it('rejects malformed, duplicate and inconsistent rows', () => {
    const { errors } = validatePincodeRows(
      'pincode,eta_min_days,eta_max_days\n56001,,\n560001,,\n560001,,\n560002,3,1\n',
    )
    expect(errors.map((e) => e.row)).toEqual([2, 4, 5])
  })
})

describe('catalog filters', () => {
  it('always restricts to published products', () => {
    expect(buildProductWhere({})).toEqual({
      and: [{ status: { equals: 'published' } }],
    })
  })

  it('maps facets to fields', () => {
    const where = buildProductWhere(
      {
        type: 'live_plant',
        fulfilment: 'pan_india',
        light: ['low_light'],
        petSafe: true,
        aroma: ['Lavender Fog'],
        minPricePaise: 10000,
        maxPricePaise: 90000,
      },
      { ids: [3, 4], collectionId: 7 },
    )
    expect(where.and).toEqual(
      expect.arrayContaining([
        { shippingClass: { not_equals: 'live_plant_bengaluru' } },
        { 'plantCare.light': { in: ['low_light'] } },
        { 'plantCare.petSafe': { equals: true } },
        { 'candleSpec.aromaNotes': { in: ['lavender fog'] } },
        { minPricePaise: { greater_than_equal: 10000 } },
        { minPricePaise: { less_than_equal: 90000 } },
        { collections: { equals: 7 } },
        { id: { in: [3, 4] } },
      ]),
    )
  })

  it('matches nothing when a search has no hits', () => {
    expect(buildProductWhere({}, { ids: [] }).and).toContainEqual({
      id: { in: [-1] },
    })
  })
})

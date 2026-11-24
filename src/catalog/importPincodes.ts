import type { Payload, PayloadRequest } from 'payload'
import { PINCODE_PATTERN } from './rules'
import { parseBoolean, parseCsv, type RowError } from '../lib/csv'
import {
  describeError,
  runInTransaction,
  type ImportResult,
} from '../lib/importRunner'

export const PINCODE_COLUMNS = {
  required: ['pincode'],
  optional: [
    'area',
    'city',
    'state',
    'eta_min_days',
    'eta_max_days',
    'enabled',
  ],
} as const

export const PINCODE_TEMPLATE =
  'pincode,area,city,state,eta_min_days,eta_max_days,enabled\n560001,,Bengaluru,Karnataka,0,1,yes\n'

type Entry = {
  row: number
  pincode: string
  area?: string
  city?: string
  state?: string
  etaMinDays?: number
  etaMaxDays?: number
  enabled?: boolean
}

function int(
  value: string | undefined,
  label: string,
  errors: RowError[],
  row: number,
) {
  if (!value) return undefined
  if (!/^\d{1,3}$/.test(value)) {
    errors.push({ row, message: `${label} must be a whole number.` })
    return undefined
  }
  return Number(value)
}

export function validatePincodeRows(text: string) {
  const parsed = parseCsv(text, PINCODE_COLUMNS, 5000)
  const errors = [...parsed.errors]
  const entries: Entry[] = []
  const seen = new Set<string>()
  for (const { row, values } of parsed.rows) {
    const pincode = values.pincode ?? ''
    if (!PINCODE_PATTERN.test(pincode)) {
      errors.push({
        row,
        message: `"${pincode}" is not a valid 6-digit PIN code.`,
      })
      continue
    }
    if (seen.has(pincode)) {
      errors.push({
        row,
        message: `PIN code ${pincode} appears more than once.`,
      })
      continue
    }
    seen.add(pincode)
    const etaMin = int(values.eta_min_days, 'eta_min_days', errors, row)
    const etaMax = int(values.eta_max_days, 'eta_max_days', errors, row)
    if (etaMin != null && etaMax != null && etaMax < etaMin) {
      errors.push({
        row,
        message: 'eta_max_days cannot be less than eta_min_days.',
      })
    }
    let enabled: boolean | undefined
    if (values.enabled) {
      const parsedBool = parseBoolean(values.enabled)
      if (parsedBool === null)
        errors.push({ row, message: 'enabled must be yes or no.' })
      else enabled = parsedBool
    }
    entries.push({
      row,
      pincode,
      area: values.area || undefined,
      city: values.city || undefined,
      state: values.state || undefined,
      etaMinDays: etaMin,
      etaMaxDays: etaMax,
      enabled,
    })
  }
  return { entries, errors }
}

export async function importPincodes(
  payload: Payload,
  user: PayloadRequest['user'],
  text: string,
  apply: boolean,
): Promise<ImportResult> {
  const { entries, errors } = validatePincodeRows(text)
  if (errors.length > 0) {
    return { ok: false, applied: false, summary: {}, errors }
  }
  return runInTransaction(payload, user, apply, async (req) => {
    const summary = { created: 0, updated: 0 }
    const rowErrors: RowError[] = []
    for (const { row, pincode, ...fields } of entries) {
      try {
        const existing = await payload.find({
          collection: 'serviceable-pincodes',
          where: { pincode: { equals: pincode } },
          limit: 1,
          depth: 0,
          req,
          overrideAccess: true,
        })
        const data = Object.fromEntries(
          Object.entries(fields).filter(([, value]) => value !== undefined),
        )
        if (existing.docs[0]) {
          await payload.update({
            collection: 'serviceable-pincodes',
            id: existing.docs[0].id,
            data,
            req,
            overrideAccess: true,
          })
          summary.updated += 1
        } else {
          await payload.create({
            collection: 'serviceable-pincodes',
            data: { pincode, city: fields.city ?? 'Bengaluru', ...data },
            req,
            overrideAccess: true,
          })
          summary.created += 1
        }
      } catch (error) {
        // A failed statement aborts the transaction, so stop at the first error.
        rowErrors.push({ row, message: describeError(error) })
        break
      }
    }
    return { summary, errors: rowErrors }
  })
}

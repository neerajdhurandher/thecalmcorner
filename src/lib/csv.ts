import { parse } from 'csv-parse/sync'

export const MAX_CSV_BYTES = 1_000_000

export type RowError = { row: number; message: string }

export type ParsedCsv = {
  /** Data rows; `row` is the spreadsheet row number (header = 1). */
  rows: { row: number; values: Record<string, string> }[]
  errors: RowError[]
}

export function parseCsv(
  text: string,
  columns: { required: readonly string[]; optional: readonly string[] },
  maxRows: number,
): ParsedCsv {
  if (text.length > MAX_CSV_BYTES) {
    return {
      rows: [],
      errors: [{ row: 0, message: 'File is larger than 1 MB.' }],
    }
  }
  let records: Record<string, string>[]
  try {
    records = parse(text, {
      bom: true,
      columns: (header: string[]) =>
        header.map((name) => name.trim().toLowerCase()),
      skip_empty_lines: true,
      trim: true,
    })
  } catch (error) {
    return {
      rows: [],
      errors: [
        {
          row: 0,
          message: `Could not read the CSV: ${(error as Error).message}`,
        },
      ],
    }
  }
  const errors: RowError[] = []
  const first = records[0] ?? {}
  const known = new Set([...columns.required, ...columns.optional])
  for (const name of columns.required) {
    if (records.length > 0 && !(name in first)) {
      errors.push({ row: 1, message: `Missing required column "${name}".` })
    }
  }
  for (const name of Object.keys(first)) {
    if (!known.has(name)) {
      errors.push({ row: 1, message: `Unknown column "${name}".` })
    }
  }
  if (records.length === 0) {
    errors.push({ row: 0, message: 'The file has no data rows.' })
  }
  if (records.length > maxRows) {
    errors.push({ row: 0, message: `Too many rows (maximum ${maxRows}).` })
  }
  return {
    rows: records.map((values, index) => ({ row: index + 2, values })),
    errors,
  }
}

/** "499", "499.5" or "499.50" rupees → paise; null when not a valid amount. */
export function rupeesToPaise(value: string): number | null {
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(value.trim())
  if (!match) return null
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0') || 0)
}

export function parseBoolean(value: string): boolean | null {
  const v = value.trim().toLowerCase()
  if (['yes', 'true', '1', 'y'].includes(v)) return true
  if (['no', 'false', '0', 'n'].includes(v)) return false
  return null
}

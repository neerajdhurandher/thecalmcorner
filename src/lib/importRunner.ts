import {
  commitTransaction,
  createLocalReq,
  initTransaction,
  killTransaction,
  type Payload,
  type PayloadRequest,
} from 'payload'
import type { RowError } from './csv'

export type ImportResult = {
  ok: boolean
  /** True only when changes were committed. */
  applied: boolean
  summary: Record<string, number>
  errors: RowError[]
}

/**
 * Runs `work` in one database transaction. With `apply` false the transaction is
 * always rolled back, so a dry run exercises every real rule without saving.
 */
export async function runInTransaction(
  payload: Payload,
  user: PayloadRequest['user'],
  apply: boolean,
  work: (
    req: PayloadRequest,
  ) => Promise<{ summary: Record<string, number>; errors: RowError[] }>,
): Promise<ImportResult> {
  const req = await createLocalReq({ user: user ?? undefined }, payload)
  await initTransaction(req)
  try {
    const { summary, errors } = await work(req)
    if (errors.length > 0 || !apply) {
      await killTransaction(req)
      return { ok: errors.length === 0, applied: false, summary, errors }
    }
    await commitTransaction(req)
    return { ok: true, applied: true, summary, errors }
  } catch (error) {
    await killTransaction(req)
    throw error
  }
}

export function describeError(error: unknown): string {
  const data = (
    error as { data?: { errors?: { path?: string; message: string }[] } }
  )?.data
  if (data?.errors?.length) {
    return data.errors
      .map((e) => (e.path ? `${e.path}: ${e.message}` : e.message))
      .join('; ')
  }
  const message = error instanceof Error ? error.message : String(error)
  return /duplicate key|unique/i.test(message)
    ? 'Duplicate value violates a unique rule.'
    : message
}

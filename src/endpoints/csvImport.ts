import type { Endpoint, PayloadRequest } from 'payload'
import { hasRole } from '../access/roles'
import { MAX_CSV_BYTES } from '../lib/csv'
import type { ImportResult } from '../lib/importRunner'

const allowed = (req: PayloadRequest) => hasRole(req.user, ['owner', 'manager'])
const forbidden = () =>
  Response.json({ error: 'Not allowed.' }, { status: 403 })

export function csvImportEndpoints(
  run: (
    req: PayloadRequest,
    text: string,
    apply: boolean,
  ) => Promise<ImportResult>,
  template: string,
  filename: string,
): Endpoint[] {
  return [
    {
      path: '/import',
      method: 'post',
      handler: async (req) => {
        if (!allowed(req)) return forbidden()
        const declared = Number(req.headers.get('content-length') ?? 0)
        if (declared > MAX_CSV_BYTES * 2) {
          return Response.json({ error: 'File is too large.' }, { status: 413 })
        }
        const text = await req.text?.()
        if (!text) {
          return Response.json(
            { error: 'Send the CSV as the request body.' },
            { status: 400 },
          )
        }
        const apply =
          new URL(req.url ?? 'http://localhost').searchParams.get('apply') ===
          'true'
        const result = await run(req, text, apply)
        return Response.json(result, { status: result.ok ? 200 : 422 })
      },
    },
    {
      path: '/import-template',
      method: 'get',
      handler: (req) =>
        allowed(req)
          ? new Response(template, {
              headers: {
                'content-type': 'text/csv; charset=utf-8',
                'content-disposition': `attachment; filename="${filename}"`,
              },
            })
          : forbidden(),
    },
  ]
}

import { Pool } from 'pg'
import { migrations } from '../../migrations'

export const dynamic = 'force-dynamic'

let pool: Pool | undefined

export async function GET() {
  try {
    if (!process.env.DATABASE_URL)
      throw new Error('DATABASE_URL is not configured')
    pool ??= new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 3000,
      statement_timeout: 3000,
    })
    const names = migrations.map((migration) => migration.name)
    const result = await pool.query<{ name: string }>(
      'SELECT name FROM payload_migrations WHERE name = ANY($1::text[])',
      [names],
    )
    if (new Set(result.rows.map((row) => row.name)).size !== names.length) {
      throw new Error('Database migrations are pending')
    }
    return Response.json(
      { status: 'ready' },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'readiness_failed',
        error: error instanceof Error ? error.name : 'UnknownError',
      }),
    )
    return Response.json(
      { status: 'not_ready' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}

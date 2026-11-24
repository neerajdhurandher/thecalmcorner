import config from '@payload-config'
import {
  REST_DELETE,
  REST_GET,
  REST_OPTIONS,
  REST_PATCH,
  REST_POST,
  REST_PUT,
} from '@payloadcms/next/routes'

// First-user registration needs the Local API token to set its HTTP-only cookie.
async function withoutToken(response: Response) {
  if (!response.ok) return response
  const body: unknown = await response.json()
  if (!body || typeof body !== 'object') {
    throw new Error('Unexpected authentication response')
  }
  const safeBody = Object.fromEntries(
    Object.entries(body).filter(([key]) => key !== 'token'),
  )
  const headers = new Headers(response.headers)
  headers.delete('content-length')
  return Response.json(safeBody, { status: response.status, headers })
}

const handleGet = REST_GET(config)
export const GET: typeof handleGet = async (request, context) => {
  const response = await handleGet(request, context)
  return new URL(request.url).pathname === '/api/users/me'
    ? withoutToken(response)
    : response
}
const handlePost = REST_POST(config)

export const POST: typeof handlePost = async (request, context) => {
  const response = await handlePost(request, context)
  const path = new URL(request.url).pathname
  return [
    '/api/users/first-register',
    '/api/users/login',
    '/api/users/reset-password',
    '/api/users/refresh-token',
  ].includes(path)
    ? withoutToken(response)
    : response
}
export const DELETE = REST_DELETE(config)
export const PATCH = REST_PATCH(config)
export const PUT = REST_PUT(config)
export const OPTIONS = REST_OPTIONS(config)

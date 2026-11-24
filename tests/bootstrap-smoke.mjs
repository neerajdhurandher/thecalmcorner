import assert from 'node:assert/strict'

const baseURL = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000'
const origin = process.env.SERVER_URL || 'http://localhost:3000'
const email = 'bootstrap@example.test'
const password = 'local-test-password-123'

async function post(path, data) {
  return fetch(`${baseURL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify(data),
  })
}

assert.equal((await fetch(`${baseURL}/health`)).status, 200)
assert.equal((await fetch(`${baseURL}/ready`)).status, 200)
const admin = await fetch(`${baseURL}/admin`)
assert.equal(admin.status, 200)
assert.equal(admin.headers.get('x-frame-options'), 'DENY')

const register = (newPassword) =>
  post('/api/users/first-register', {
    name: 'Test owner',
    email,
    password: newPassword,
  })
assert.equal((await register('short')).status, 400)
const first = await register(password)
assert.equal(first.status, 200)
const firstBody = await first.json()
assert.equal(firstBody.user.role, 'owner')
assert.equal('token' in firstBody, false)
const cookie = first.headers.get('set-cookie')
assert.ok(cookie)
assert.match(cookie, /HttpOnly/i)
assert.match(cookie, /SameSite=Lax/i)
assert.equal((await register(password)).status, 403)

const me = await fetch(`${baseURL}/api/users/me`, {
  headers: { cookie: cookie.split(';')[0], origin },
})
const meBody = await me.json()
assert.equal(meBody.user.role, 'owner')
assert.equal('token' in meBody, false)
const login = await post('/api/users/login', { email, password })
assert.equal(login.status, 200)
const loginBody = await login.json()
assert.equal('token' in loginBody, false)
assert.match(login.headers.get('set-cookie') || '', /HttpOnly/i)
const refresh = await fetch(`${baseURL}/api/users/refresh-token`, {
  method: 'POST',
  headers: { cookie: cookie.split(';')[0], origin },
})
assert.equal(refresh.status, 200)
assert.equal('token' in (await refresh.json()), false)

// Phase 2: admin CSV import, templates and public search.
const authed = { cookie: cookie.split(';')[0], origin }
const importCsv = (path, csv, apply) =>
  fetch(`${baseURL}${path}?apply=${apply}`, {
    method: 'POST',
    headers: { ...authed, 'content-type': 'text/csv' },
    body: csv,
  })
const anonymous = await fetch(`${baseURL}/api/serviceable-pincodes/import`, {
  method: 'POST',
  headers: { origin, 'content-type': 'text/csv' },
  body: 'pincode\n560001\n',
})
assert.equal(anonymous.status, 403)
const template = await fetch(`${baseURL}/api/products/import-template`, {
  headers: authed,
})
assert.equal(template.status, 200)
assert.match(await template.text(), /^product_slug,/)

const pins = 'pincode,area\n560001,Central\n560002,\n'
const dry = await importCsv('/api/serviceable-pincodes/import', pins, false)
assert.deepEqual((await dry.json()).applied, false)
const real = await importCsv('/api/serviceable-pincodes/import', pins, true)
const realBody = await real.json()
assert.equal(real.status, 200)
assert.deepEqual(realBody.summary, { created: 2, updated: 0 })
const bad = await importCsv(
  '/api/serviceable-pincodes/import',
  'pincode\n12\n',
  true,
)
assert.equal(bad.status, 422)

const catalog = [
  'product_slug,product_title,product_type,shipping_class,sku,price_inr,description,aroma_notes,opening_stock',
  'smoke-candle,Smoke candle,candle,candle_protective,SMOKE-1,499,Smoke test candle,lavender fog,5',
].join('\n')
assert.equal(
  (await importCsv('/api/products/import', catalog, true)).status,
  200,
)
const login2 = await post('/api/users/login', { email, password })
const search = await fetch(`${baseURL}/api/products/search?q=smoke`)
assert.equal(search.status, 200)
assert.equal((await search.json()).totalDocs, 0) // drafts are never public
assert.equal(
  (await fetch(`${baseURL}/api/products/search?type=bogus`)).status,
  400,
)
assert.ok(login2.ok)
const list = await fetch(`${baseURL}/admin/collections/serviceable-pincodes`, {
  headers: authed,
})
assert.equal(list.status, 200)
console.log(
  'Container health, readiness, bootstrap, authentication and cookies verified.',
)

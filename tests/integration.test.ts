import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import type { User } from '../src/payload-types'

const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('Payload access and audit integration', () => {
  let payload: Payload
  let owner: User
  let content: User
  let manager: User
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const password = 'local-test-password-123'

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl
    process.env.PAYLOAD_SECRET = 'integration-test-secret-not-for-production'
    process.env.SERVER_URL = 'http://localhost:3000'
    const [{ getPayload }, { default: config }] = await Promise.all([
      import('payload'),
      import('../src/payload.config'),
    ])
    payload = await getPayload({ config })
    owner = await payload.create({
      collection: 'users',
      data: {
        name: 'Test owner',
        email: `owner-${suffix}@example.test`,
        password,
        role: 'owner',
      },
    })
    content = await payload.create({
      collection: 'users',
      data: {
        name: 'Test editor',
        email: `content-${suffix}@example.test`,
        password,
        role: 'content',
      },
      user: owner,
      overrideAccess: false,
    })
    manager = await payload.create({
      collection: 'users',
      data: {
        name: 'Test manager',
        email: `manager-${suffix}@example.test`,
        password,
        role: 'manager',
      },
      user: owner,
      overrideAccess: false,
    })
  }, 30000)

  afterAll(async () => {
    if (payload) await payload.destroy()
  })

  it('authenticates staff and records the login without credentials', async () => {
    const result = await payload.login({
      collection: 'users',
      data: { email: owner.email, password },
    })
    expect(result.user?.id).toBe(owner.id)
    const logs = await payload.find({
      collection: 'audit-logs',
      where: {
        and: [
          { action: { equals: 'login' } },
          { actorId: { equals: String(owner.id) } },
        ],
      },
    })
    expect(logs.totalDocs).toBeGreaterThan(0)
    expect(JSON.stringify(logs.docs)).not.toContain(password)
  })

  it('rejects short passwords on creation, update, and reset', async () => {
    const passwordError = {
      name: 'ValidationError',
      data: {
        errors: [
          {
            path: 'password',
            message: 'Password must be at least 12 characters',
          },
        ],
      },
    }
    await expect(
      payload.create({
        collection: 'users',
        data: {
          name: 'Short password',
          email: `short-${suffix}@example.test`,
          password: 'short',
          role: 'content',
        },
        user: owner,
        overrideAccess: false,
      }),
    ).rejects.toMatchObject(passwordError)
    await expect(
      payload.update({
        collection: 'users',
        id: content.id,
        data: { password: 'short' },
        user: owner,
        overrideAccess: false,
      }),
    ).rejects.toMatchObject(passwordError)
    const token = await payload.forgotPassword({
      collection: 'users',
      data: { email: content.email },
      disableEmail: true,
    })
    await expect(
      payload.resetPassword({
        collection: 'users',
        data: { password: 'short', token },
        overrideAccess: false,
      }),
    ).rejects.toMatchObject(passwordError)
  })

  it('prevents a staff member from promoting themselves or modifying the audit log', async () => {
    await payload.update({
      collection: 'users',
      id: content.id,
      data: { role: 'owner' },
      user: content,
      overrideAccess: false,
    })
    const user = await payload.findByID({ collection: 'users', id: content.id })
    expect(user.role).toBe('content')
    await expect(
      payload.create({
        collection: 'audit-logs',
        data: {
          action: 'login',
          resource: 'users',
          targetId: '1',
          actorId: '1',
        },
        user: owner,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    await expect(
      payload.find({
        collection: 'audit-logs',
        user: content,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('enforces catalog permissions and hides drafts from anonymous readers', async () => {
    const product = await payload.create({
      collection: 'products',
      data: {
        title: 'Test',
        slug: `test-${suffix}`,
        type: 'candle',
        shippingClass: 'candle_protective',
        status: 'draft',
      },
      user: manager,
      overrideAccess: false,
    })
    await expect(
      payload.update({
        collection: 'products',
        id: product.id,
        data: { title: 'Unauthorized' },
        user: content,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    const publicResults = await payload.find({
      collection: 'products',
      where: { id: { equals: product.id } },
      overrideAccess: false,
    })
    expect(publicResults.totalDocs).toBe(0)
    const logs = await payload.find({
      collection: 'audit-logs',
      where: {
        and: [
          { resource: { equals: 'products' } },
          { targetId: { equals: String(product.id) } },
        ],
      },
    })
    expect(
      logs.docs.some(
        (log) => log.actorId === String(manager.id) && log.action === 'create',
      ),
    ).toBe(true)
  })

  it('allows editors to update settings and records the change', async () => {
    await payload.updateGlobal({
      slug: 'store-settings',
      data: { announcement: `Test ${suffix}` },
      user: content,
      overrideAccess: false,
    })
    const logs = await payload.find({
      collection: 'audit-logs',
      where: {
        and: [
          { resource: { equals: 'store-settings' } },
          { actorId: { equals: String(content.id) } },
        ],
      },
    })
    expect(logs.totalDocs).toBeGreaterThan(0)
  })
})

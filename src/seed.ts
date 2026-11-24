import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getPayload } from 'payload'
import { importCatalog } from './catalog/importCatalog'
import { importPincodes } from './catalog/importPincodes'
import config from './payload.config'

if (process.env.NODE_ENV === 'production') {
  throw new Error('The sample seed must not run in production')
}

const email = process.env.SEED_ADMIN_EMAIL
const password = process.env.SEED_ADMIN_PASSWORD
if (Boolean(email) !== Boolean(password)) {
  throw new Error(
    'Set both SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD, or neither',
  )
}
if (password && password.length < 12)
  throw new Error('SEED_ADMIN_PASSWORD must be at least 12 characters')

const payload = await getPayload({ config })
try {
  if (email && password) {
    const users = await payload.count({ collection: 'users' })
    if (users.totalDocs === 0) {
      await payload.create({
        collection: 'users',
        data: { email, password, name: 'Local owner', role: 'owner' },
      })
      payload.logger.info('Created local owner')
    } else {
      payload.logger.info('Staff already exist; no owner created or changed')
    }
  }

  const read = (name: string) =>
    readFile(path.resolve('data/seed', name), 'utf8')
  const pins = await importPincodes(
    payload,
    null,
    await read('bengaluru-pincodes.sample.csv'),
    true,
  )
  const catalog = await importCatalog(
    payload,
    null,
    await read('catalog.sample.csv'),
    true,
  )
  for (const result of [pins, catalog]) {
    if (!result.ok) throw new Error(JSON.stringify(result.errors))
  }

  const coupon = await payload.count({
    collection: 'coupons',
    where: { code: { equals: 'WELCOME10' } },
  })
  if (coupon.totalDocs === 0) {
    await payload.create({
      collection: 'coupons',
      data: {
        code: 'WELCOME10',
        description: 'Sample: 10% off orders over ₹499',
        active: true,
        type: 'percent',
        value: 10,
        minOrderPaise: 49900,
        maxDiscountPaise: 20000,
      },
    })
  }
  payload.logger.info('Local sample seed complete')
} finally {
  await payload.destroy()
}

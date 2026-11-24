import 'dotenv/config'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { AuditLogs } from './collections/AuditLogs'
import { CareGuides } from './collections/CareGuides'
import { Coupons } from './collections/Coupons'
import { Customers } from './collections/Customers'
import { JournalPosts } from './collections/JournalPosts'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { ProductCollections } from './collections/ProductCollections'
import { Products } from './collections/Products'
import { ServiceablePincodes } from './collections/ServiceablePincodes'
import { StockAdjustments } from './collections/StockAdjustments'
import { StockLevels } from './collections/StockLevels'
import { Users } from './collections/Users'
import { Variants } from './collections/Variants'
import { StoreSettings } from './globals/StoreSettings'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const secret = process.env.PAYLOAD_SECRET
const databaseUrl = process.env.DATABASE_URL
const serverURL = process.env.SERVER_URL

if (!secret || secret.length < 32)
  throw new Error('PAYLOAD_SECRET must be at least 32 characters')
if (!databaseUrl) throw new Error('DATABASE_URL is required')
if (!serverURL) throw new Error('SERVER_URL is required')
const siteURL = new URL(serverURL)
const localHttp =
  process.env.ALLOW_INSECURE_LOCAL === 'true' &&
  siteURL.protocol === 'http:' &&
  ['localhost', '127.0.0.1'].includes(siteURL.hostname)
if (
  process.env.NODE_ENV === 'production' &&
  siteURL.protocol !== 'https:' &&
  !localHttp
) {
  throw new Error('SERVER_URL must use HTTPS in production')
}

if (
  process.env.NODE_ENV === 'production' &&
  !localHttp &&
  (!process.env.SMTP_HOST || !process.env.SMTP_FROM_ADDRESS)
) {
  throw new Error('SMTP_HOST and SMTP_FROM_ADDRESS are required in production')
}
if (
  process.env.NODE_ENV === 'production' &&
  !localHttp &&
  process.env.SMTP_SECURE !== 'true' &&
  process.env.SMTP_REQUIRE_TLS !== 'true'
) {
  throw new Error('Enable SMTP_SECURE or SMTP_REQUIRE_TLS in production')
}
if (Boolean(process.env.SMTP_USER) !== Boolean(process.env.SMTP_PASSWORD)) {
  throw new Error('SMTP_USER and SMTP_PASSWORD must be configured together')
}

const s3Bucket = process.env.S3_BUCKET
const s3Region = process.env.S3_REGION
const s3AccessKey = process.env.S3_ACCESS_KEY_ID
const s3Secret = process.env.S3_SECRET_ACCESS_KEY
if (s3Bucket && (!s3Region || !s3AccessKey || !s3Secret)) {
  throw new Error(
    'S3_REGION, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required with S3_BUCKET',
  )
}

export default buildConfig({
  serverURL,
  csrf: [serverURL],
  admin: { user: Users.slug, importMap: { baseDir: dirname } },
  collections: [
    Users,
    Customers,
    Media,
    Products,
    Variants,
    ProductCollections,
    StockLevels,
    StockAdjustments,
    Coupons,
    ServiceablePincodes,
    Pages,
    JournalPosts,
    CareGuides,
    AuditLogs,
  ],
  globals: [StoreSettings],
  editor: lexicalEditor(),
  secret,
  db: postgresAdapter({ pool: { connectionString: databaseUrl }, push: false }),
  email: nodemailerAdapter({
    defaultFromAddress: process.env.SMTP_FROM_ADDRESS || 'hello@example.test',
    defaultFromName: process.env.EMAIL_FROM_NAME || 'The Calm Corner',
    skipVerify: process.env.BUILD_WITHOUT_SMTP === 'true',
    transportOptions: {
      host: process.env.SMTP_HOST || 'localhost',
      port: Number(process.env.SMTP_PORT || 1025),
      secure: process.env.SMTP_SECURE === 'true',
      requireTLS: process.env.SMTP_REQUIRE_TLS === 'true',
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASSWORD
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
          : undefined,
    },
  }),
  plugins: [
    s3Storage({
      enabled: Boolean(s3Bucket),
      alwaysInsertFields: true,
      collections: { media: true },
      bucket: s3Bucket || '',
      config: {
        region: s3Region,
        endpoint: process.env.S3_ENDPOINT || undefined,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
        credentials:
          s3AccessKey && s3Secret
            ? { accessKeyId: s3AccessKey, secretAccessKey: s3Secret }
            : undefined,
      },
    }),
  ],
  sharp,
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
})

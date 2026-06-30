// Server entry point: connect to MongoDB (Atlas or local), then start the API.
import 'dotenv/config'
import { MongoClient, GridFSBucket } from 'mongodb'
import { createApp } from './app.js'
import { ensureDefaultAdmin } from './auth.js'

const uri = process.env.MONGODB_URI
const dbName = process.env.DB_NAME || 'content_calendar'
const port = Number(process.env.PORT || 4000)

if (!uri) {
  console.error(
    '\n✗ Missing MONGODB_URI.\n' +
      '  Copy server/.env.example to server/.env and paste your MongoDB Atlas\n' +
      '  connection string (Atlas → Connect → Drivers).\n',
  )
  process.exit(1)
}

const client = new MongoClient(uri)
await client.connect()
const db = client.db(dbName)
const bucket = new GridFSBucket(db, { bucketName: 'media' })

// Create the first admin from env if the users collection is empty.
const admin = await ensureDefaultAdmin(db, {
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_PASSWORD,
  name: process.env.ADMIN_NAME || 'Admin',
})
if (admin) console.log(`✓ Created first admin: ${admin.email}`)

const app = createApp({ db, bucket })
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`✓ Content-calendar API running on http://localhost:${port}  (database: ${dbName})`)
})

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    await client.close().catch(() => {})
    process.exit(0)
  })
}

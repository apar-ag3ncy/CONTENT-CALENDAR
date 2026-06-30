// Local dev convenience: run the API against an in-memory MongoDB, pre-seeded
// with the two sample days. Lets you try the full app (read + write + photo
// upload) WITHOUT a MongoDB Atlas account. Data resets each restart.
//
//   npm run dev:memory      (then set VITE_API_URL=http://localhost:4000)
//
// For real, persistent, shared data use a MongoDB Atlas URI with `npm start`.
import { MongoMemoryServer } from 'mongodb-memory-server'
import { MongoClient, GridFSBucket } from 'mongodb'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createApp } from './app.js'
import { seedDatabase } from './seed.js'
import { ensureDefaultAdmin } from './auth.js'

const DEV_ADMIN = { email: 'admin@apar.agency', password: 'admin1234', name: 'Apar Admin' }

const __dirname = dirname(fileURLToPath(import.meta.url))
const port = Number(process.env.PORT || 4000)

console.log('Starting in-memory MongoDB …')
const mongod = await MongoMemoryServer.create()
const client = new MongoClient(mongod.getUri())
await client.connect()
const db = client.db('content_calendar')
const bucket = new GridFSBucket(db, { bucketName: 'media' })

console.log('Seeding sample data …')
const n = await seedDatabase(db, bucket, {
  photosDir: join(__dirname, '..', 'public', 'photos'),
  publicUrl: `http://localhost:${port}`,
  log: (m) => console.log(m),
})

await ensureDefaultAdmin(db, DEV_ADMIN)

const app = createApp({ db, bucket })
app.listen(port, () => {
  console.log(`\n✓ DEV API (in-memory MongoDB, ${n} items seeded) on http://localhost:${port}`)
  console.log('  Point the frontend at it:  VITE_API_URL=http://localhost:' + port + '  in .env.local')
  console.log(`  Sign in with:  ${DEV_ADMIN.email}  /  ${DEV_ADMIN.password}  (admin)\n`)
})

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    await client.close().catch(() => {})
    await mongod.stop().catch(() => {})
    process.exit(0)
  })
}

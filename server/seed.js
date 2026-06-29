// Seed the database with the two sample days (the same content the demo grid
// shows) and upload the photos into MongoDB (GridFS) so a fresh database is
// immediately explorable.
//
//   • `seedDatabase(db, bucket, opts)` is the reusable core (also used by the
//     in-memory dev server, dev-memory.mjs).
//   • Running this file directly connects with MONGODB_URI and seeds it:
//        npm run seed
import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { MongoClient, GridFSBucket, ObjectId } from 'mongodb'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_PHOTOS_DIR = join(__dirname, '..', 'public', 'photos')

// The real files in /public/photos.
const A = '15 JAN MIREYAA GRID-01.jpg'
const B = '15 JAN MIREYAA GRID-05.jpg'
const C = '15 JAN MIREYAA GRID-07.jpg'
const D = 'magnific_use-img1-as-the-sole-refe_mC2WOgEhJQ.jpeg'
const E = 'magnific_use-img1-as-the-sole-refe_nTlJ5s6YQD.jpeg'
const F = 'appleArtboard 1 copy 12.png'
const VID = '1782300006428813-ezremove.mp4'

const CONTENT_TYPE = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
}
const STAMP = '2026-01-01T00:00:00.000Z'

function uploadFile(bucket, buffer, name, publicUrl) {
  return new Promise((resolve, reject) => {
    const _id = new ObjectId()
    const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : 'bin'
    const stream = bucket.openUploadStreamWithId(_id, name, {
      contentType: CONTENT_TYPE[ext] || 'application/octet-stream',
      metadata: { name },
    })
    stream.on('finish', () => resolve({ url: `${publicUrl}/api/media/${_id}`, path: String(_id), name }))
    stream.on('error', reject)
    stream.end(buffer)
  })
}

/** Wipe the seeded collections + uploaded media, then insert the two sample days. */
export async function seedDatabase(db, bucket, { photosDir = DEFAULT_PHOTOS_DIR, publicUrl = 'http://localhost:4000', log = () => {} } = {}) {
  for (const c of ['content_items', 'day_notes']) await db.collection(c).deleteMany({})
  await db.collection('media.files').deleteMany({}).catch(() => {})
  await db.collection('media.chunks').deleteMany({}).catch(() => {})

  // Upload each used photo into GridFS and map name → MediaItem.
  const used = [A, B, C, D, E, F, VID]
  const asset = {}
  for (const name of used) {
    try {
      const buf = await readFile(join(photosDir, name))
      asset[name] = await uploadFile(bucket, buf, name, publicUrl)
      log(`  ↑ ${name} (${(buf.length / 1024).toFixed(0)} KB)`)
    } catch (e) {
      log(`  ! skipped ${name}: ${e.message}`)
    }
  }
  const media = (...names) => names.map((n) => asset[n]).filter(Boolean)

  const mk = (p) => ({
    date: p.date,
    day_of_week: p.day,
    type: p.type,
    post_format: p.format ?? (p.type === 'post' ? 'static' : null),
    media_type: p.mediaType ?? (p.type === 'reel' ? 'video' : p.type === 'caption' ? null : 'photo'),
    media: p.media ?? [],
    title: p.title,
    caption: p.caption ?? null,
    drive_link: null,
    category_id: null,
    status: p.status ?? 'idea',
    assigned_to: null,
    notes: null,
    grid_position: p.grid ?? null,
    created_at: STAMP,
    updated_at: STAMP,
  })

  const items = [
    // ── Day 1 — Thursday, July 2 2026 — 1 Post · 1 Reel · 2 Stories ──
    mk({ date: '2026-07-02', day: 'Thursday', type: 'post', format: 'static', title: 'Statement set', caption: 'The piece that turns every head. ✨\n\n#Mireyaa #FineJewellery', status: 'scheduled', grid: 0, media: media(A) }),
    mk({ date: '2026-07-02', day: 'Thursday', type: 'reel', title: 'The reveal', caption: '15 seconds with the new collection. 🎬 Sound on.', status: 'ready', grid: 1, media: media(VID) }),
    mk({ date: '2026-07-02', day: 'Thursday', type: 'story', title: 'Sneak peek', caption: 'Dropping tomorrow.', status: 'ready', media: media(B) }),
    mk({ date: '2026-07-02', day: 'Thursday', type: 'story', title: 'BTS in the studio', caption: 'Styling the shoot.', status: 'drafting', media: media(D) }),

    // ── Day 2 — Friday, July 3 2026 — 1 Carousel (4 posts) · 4 Stories ──
    mk({ date: '2026-07-03', day: 'Friday', type: 'post', format: 'carousel', title: 'The bridal edit', caption: 'Four ways to wear the collection. Swipe → 💍\n\n#BridalEdit #Mireyaa', status: 'drafting', grid: 2, media: media(E, C, F, A) }),
    mk({ date: '2026-07-03', day: 'Friday', type: 'story', title: 'New drop is live', caption: 'Swipe up.', status: 'ready', media: media(B) }),
    mk({ date: '2026-07-03', day: 'Friday', type: 'story', title: 'Behind the bridal set', caption: 'On set today.', status: 'drafting', media: media(C) }),
    mk({ date: '2026-07-03', day: 'Friday', type: 'story', title: 'Poll: which piece?', caption: 'Tap to vote.', status: 'idea', media: media(D) }),
    mk({ date: '2026-07-03', day: 'Friday', type: 'story', title: 'Last call', caption: 'Closing the edit.', status: 'ready', media: media(E) }),
  ]

  await db.collection('content_items').insertMany(items)
  return items.length
}

// ── CLI entry: seed the real MONGODB_URI database ──
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const uri = process.env.MONGODB_URI
  const dbName = process.env.DB_NAME || 'content_calendar'
  const publicUrl = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`
  if (!uri) {
    console.error('✗ Missing MONGODB_URI — set it in server/.env first.')
    process.exit(1)
  }
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)
  const bucket = new GridFSBucket(db, { bucketName: 'media' })
  console.log(`Seeding "${dbName}" …`)
  const n = await seedDatabase(db, bucket, { publicUrl, log: (m) => console.log(m) })
  console.log(`✓ Seeded ${n} content items across July 2–3, 2026.`)
  await client.close()
  console.log('Done.')
}

// Smoke test: boot a REAL MongoDB (in-memory) + the API, then exercise every
// endpoint over HTTP — including a GridFS photo round-trip. Proves the exact
// code that will run against MongoDB Atlas works. Run: node test-smoke.mjs
import { MongoMemoryServer } from 'mongodb-memory-server'
import { MongoClient, GridFSBucket } from 'mongodb'
import { createApp } from './app.js'

let pass = 0
let fail = 0
function check(name, cond, extra = '') {
  if (cond) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    console.log(`  ✗ ${name} ${extra}`)
  }
}

const mongod = await MongoMemoryServer.create()
const uri = mongod.getUri()
const client = new MongoClient(uri)
await client.connect()
const db = client.db('content_calendar_test')
const bucket = new GridFSBucket(db, { bucketName: 'media' })
const app = createApp({ db, bucket })
const server = app.listen(0)
const port = server.address().port
const BASE = `http://localhost:${port}`
const j = (r) => r.json()

try {
  console.log(`\nAPI up on ${BASE} (in-memory MongoDB)\n`)

  // health
  check('health ok', (await j(await fetch(`${BASE}/api/health`))).ok === true)

  // create a post + a reel
  const post = await j(
    await fetch(`${BASE}/api/content`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ date: '2026-07-02', type: 'post', title: 'Statement set', status: 'scheduled', grid_position: 0, media: [] }),
    }),
  )
  check('create post returns id', typeof post.id === 'string' && post.id.length > 0, JSON.stringify(post))
  check('create post stamps created_at/updated_at', !!post.created_at && !!post.updated_at)

  const reel = await j(
    await fetch(`${BASE}/api/content`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ date: '2026-07-02', type: 'reel', title: 'The reveal', status: 'ready', grid_position: 1, media: [] }),
    }),
  )
  const story = await j(
    await fetch(`${BASE}/api/content`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ date: '2026-07-02', type: 'story', title: 'Sneak peek', status: 'ready', media: [] }),
    }),
  )

  // read by day
  const day = await j(await fetch(`${BASE}/api/content?date=2026-07-02`))
  check('GET ?date returns 3 items', Array.isArray(day) && day.length === 3, `got ${day.length}`)

  // read by range
  const range = await j(await fetch(`${BASE}/api/content?start=2026-07-01&end=2026-07-31`))
  check('GET range returns the items', range.length === 3)

  // grid = posts + reels only (no story)
  const grid = await j(await fetch(`${BASE}/api/content/grid`))
  check('GET /grid excludes stories', grid.length === 2 && grid.every((i) => i.type !== 'story'))
  check('GET /grid ordered by grid_position', grid[0].grid_position <= grid[1].grid_position)

  // reorder: put the reel first
  await fetch(`${BASE}/api/content/grid/reorder`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ orderedIds: [reel.id, post.id] }),
  })
  const grid2 = await j(await fetch(`${BASE}/api/content/grid`))
  check('reorder renumbers grid_position from 1', grid2[0].id === reel.id && grid2[0].grid_position === 1 && grid2[1].grid_position === 2)

  // patch status
  await fetch(`${BASE}/api/content/${post.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'posted' }),
  })
  const afterPatch = (await j(await fetch(`${BASE}/api/content?date=2026-07-02`))).find((i) => i.id === post.id)
  check('PATCH updates status', afterPatch.status === 'posted')

  // day note upsert
  await fetch(`${BASE}/api/day-notes/2026-07-02`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ note: 'Festival push — keep it cheerful.' }),
  })
  const note = await j(await fetch(`${BASE}/api/day-notes/2026-07-02`))
  check('day note upsert + read', note && note.note.includes('Festival'))

  // categories
  await fetch(`${BASE}/api/categories`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Bridal', color: '#214034' }) })
  const cats = await j(await fetch(`${BASE}/api/categories`))
  check('category create + list', cats.length === 1 && cats[0].name === 'Bridal')

  // app info
  await fetch(`${BASE}/api/app-info`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: 'Team handbook' }) })
  const info = await j(await fetch(`${BASE}/api/app-info`))
  check('app-info upsert + read', info && info.id === 'main' && info.content === 'Team handbook')

  // ── media (GridFS) round-trip ──
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  const fd = new FormData()
  fd.append('file', new Blob([bytes], { type: 'image/jpeg' }), 'test.jpg')
  const up = await j(await fetch(`${BASE}/api/media`, { method: 'POST', body: fd }))
  check('media upload returns url+path+name', !!up.url && !!up.path && up.name === 'test.jpg', JSON.stringify(up))
  const got = await fetch(`${BASE}/api/media/${up.path}`)
  const gotBuf = new Uint8Array(await got.arrayBuffer())
  check('media download returns same bytes', gotBuf.length === bytes.length && gotBuf[0] === 0xff, `len ${gotBuf.length}`)
  check('media served with content-type', (got.headers.get('content-type') || '').includes('image/jpeg'))
  // range request
  const ranged = await fetch(`${BASE}/api/media/${up.path}`, { headers: { Range: 'bytes=0-3' } })
  check('media supports range (206)', ranged.status === 206 && (await ranged.arrayBuffer()).byteLength === 4)

  // delete content with media cleanup
  const del = await fetch(`${BASE}/api/content/${post.id}`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mediaPaths: [up.path] }),
  })
  check('DELETE content → 204', del.status === 204)
  const after = await j(await fetch(`${BASE}/api/content?date=2026-07-02`))
  check('item removed', !after.find((i) => i.id === post.id))
  const goneMedia = await fetch(`${BASE}/api/media/${up.path}`)
  check('media cleaned up (404)', goneMedia.status === 404)

  void story
} catch (e) {
  fail++
  console.error('\n✗ threw:', e)
} finally {
  await new Promise((r) => server.close(r))
  await client.close()
  await mongod.stop()
  console.log(`\n${pass} passed, ${fail} failed\n`)
  process.exit(fail ? 1 : 0)
}

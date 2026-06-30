// Smoke test: boot a REAL MongoDB (in-memory) + the API, then exercise every
// endpoint over HTTP — including auth, roles, and a GridFS photo round-trip.
// Run: node test-smoke.mjs
import { MongoMemoryServer } from 'mongodb-memory-server'
import { MongoClient, GridFSBucket } from 'mongodb'
import { createApp } from './app.js'
import { ensureDefaultAdmin } from './auth.js'

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
const client = new MongoClient(mongod.getUri())
await client.connect()
const db = client.db('content_calendar_test')
const bucket = new GridFSBucket(db, { bucketName: 'media' })
await ensureDefaultAdmin(db, { email: 'admin@test.dev', password: 'adminpass', name: 'Admin' })
const app = createApp({ db, bucket })
const server = app.listen(0)
const port = server.address().port
const BASE = `http://localhost:${port}`
const j = (r) => r.json()

// fetch with a bearer token + JSON content-type (unless body is FormData).
function af(token, path, init = {}) {
  const isForm = init.body instanceof FormData
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body && !isForm ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  })
}

try {
  console.log(`\nAPI up on ${BASE} (in-memory MongoDB)\n`)

  check('health is public', (await j(await fetch(`${BASE}/api/health`))).ok === true)

  // ── auth ──
  check('unauthenticated read → 401', (await af(null, '/api/content?date=2026-07-02')).status === 401)
  check('login with wrong password → 401', (await af(null, '/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@test.dev', password: 'nope' }) })).status === 401)
  const login = await j(await af(null, '/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@test.dev', password: 'adminpass' }) }))
  check('admin login returns token + user', typeof login.token === 'string' && login.user.role === 'admin', JSON.stringify(login))
  const ADMIN = login.token
  const me = await j(await af(ADMIN, '/api/auth/me'))
  check('/auth/me returns the admin', me.email === 'admin@test.dev' && me.role === 'admin')

  // ── content (admin) ──
  const post = await j(await af(ADMIN, '/api/content', { method: 'POST', body: JSON.stringify({ date: '2026-07-02', type: 'post', title: 'Statement set', status: 'scheduled', grid_position: 0, media: [] }) }))
  check('admin can create a post', typeof post.id === 'string')
  await af(ADMIN, '/api/content', { method: 'POST', body: JSON.stringify({ date: '2026-07-02', type: 'reel', title: 'The reveal', status: 'ready', grid_position: 1, media: [] }) })
  const day = await j(await af(ADMIN, '/api/content?date=2026-07-02'))
  check('admin reads the day', day.length === 2)
  const grid = await j(await af(ADMIN, '/api/content/grid'))
  check('grid excludes stories, ordered', grid.length === 2 && grid[0].grid_position <= grid[1].grid_position)
  await af(ADMIN, '/api/content/grid/reorder', { method: 'POST', body: JSON.stringify({ orderedIds: grid.map((g) => g.id).reverse() }) })
  await af(ADMIN, `/api/content/${post.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'posted' }) })
  check('admin patch status', (await j(await af(ADMIN, '/api/content?date=2026-07-02'))).find((i) => i.id === post.id).status === 'posted')

  // ── users + roles ──
  const mgr = await j(await af(ADMIN, '/api/users', { method: 'POST', body: JSON.stringify({ email: 'mgr@test.dev', password: 'mgrpass', name: 'Manager', role: 'manager' }) }))
  check('admin creates a manager', mgr.role === 'manager')
  const mgrLogin = await j(await af(null, '/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'mgr@test.dev', password: 'mgrpass' }) }))
  const MGR = mgrLogin.token
  check('manager can read', (await af(MGR, '/api/content?date=2026-07-02')).status === 200)
  check('manager can PATCH status', (await af(MGR, `/api/content/${post.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'ready' }) })).status === 200)
  check('manager CANNOT edit other fields', (await af(MGR, `/api/content/${post.id}`, { method: 'PATCH', body: JSON.stringify({ title: 'hacked' }) })).status === 403)
  check('manager CANNOT create content', (await af(MGR, '/api/content', { method: 'POST', body: JSON.stringify({ date: '2026-07-02', type: 'post', media: [] }) })).status === 403)
  check('manager CANNOT delete content', (await af(MGR, `/api/content/${post.id}`, { method: 'DELETE' })).status === 403)
  check('manager CANNOT list users', (await af(MGR, '/api/users')).status === 403)
  check('manager CANNOT create users', (await af(MGR, '/api/users', { method: 'POST', body: JSON.stringify({ email: 'x@y.z', password: 'p' }) })).status === 403)
  check('last-admin protection', (await af(ADMIN, `/api/users/${me.id}`, { method: 'PATCH', body: JSON.stringify({ role: 'manager' }) })).status === 400)

  // ── day notes / categories / app-info (admin) ──
  await af(ADMIN, '/api/day-notes/2026-07-02', { method: 'PUT', body: JSON.stringify({ note: 'Festival push.' }) })
  check('day note upsert', (await j(await af(ADMIN, '/api/day-notes/2026-07-02'))).note.includes('Festival'))
  await af(ADMIN, '/api/categories', { method: 'POST', body: JSON.stringify({ name: 'Bridal', color: '#214034' }) })
  check('category create + list', (await j(await af(ADMIN, '/api/categories'))).length === 1)

  // ── media (GridFS) — upload needs auth, GET is public ──
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])
  const fd = new FormData()
  fd.append('file', new Blob([bytes], { type: 'image/jpeg' }), 'test.jpg')
  check('manager CANNOT upload media', (await af(MGR, '/api/media', { method: 'POST', body: fd })).status === 403)
  const fd2 = new FormData()
  fd2.append('file', new Blob([bytes], { type: 'image/jpeg' }), 'test.jpg')
  const up = await j(await af(ADMIN, '/api/media', { method: 'POST', body: fd2 }))
  check('admin uploads media', !!up.path && up.name === 'test.jpg')
  const got = await fetch(`${BASE}/api/media/${up.path}`) // no auth header
  check('media GET is public', got.status === 200 && (await got.arrayBuffer()).byteLength === bytes.length)

  // ── delete (admin) ──
  check('admin deletes content', (await af(ADMIN, `/api/content/${post.id}`, { method: 'DELETE', body: JSON.stringify({ mediaPaths: [up.path] }) })).status === 204)
  check('media cleaned up', (await fetch(`${BASE}/api/media/${up.path}`)).status === 404)
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

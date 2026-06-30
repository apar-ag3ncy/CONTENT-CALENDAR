// The content-calendar API. Pure data layer over MongoDB (works against a local
// MongoDB, mongodb-memory-server, or MongoDB Atlas — only the connection string
// differs). Photos are stored in MongoDB itself via GridFS.
//
// createApp() takes an already-connected { db, bucket } so the same routes are
// reused by index.js (real server) and the test/seed scripts.
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { ObjectId } from 'mongodb'
import { makeAuth, comparePassword, hashPassword, signToken, publicUser } from './auth.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024 }, // 60 MB per file
})

/** Mongo `_id` → the string `id` the frontend expects (Firestore-style). */
function serialize(doc) {
  if (!doc) return doc
  const { _id, ...rest } = doc
  return { id: String(_id), ...rest }
}

/** Parse an id string into an ObjectId, or null if malformed. */
function oid(id) {
  try {
    return new ObjectId(String(id))
  } catch {
    return null
  }
}

const byName = (a, b) => (a.name ?? '') < (b.name ?? '') ? -1 : (a.name ?? '') > (b.name ?? '') ? 1 : 0

/** date asc → grid_position asc (nulls last) → created_at asc. */
function byDateGridCreated(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  const ag = a.grid_position
  const bg = b.grid_position
  if (ag !== bg) {
    if (ag == null) return 1
    if (bg == null) return -1
    return ag - bg
  }
  const ac = a.created_at ?? ''
  const bc = b.created_at ?? ''
  return ac < bc ? -1 : ac > bc ? 1 : 0
}

/** grid_position asc (nulls last) → date asc — the Overview feed order. */
function byGridThenDate(a, b) {
  const ag = a.grid_position
  const bg = b.grid_position
  if (ag !== bg) {
    if (ag == null) return 1
    if (bg == null) return -1
    return ag - bg
  }
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  return 0
}

export function createApp({ db, bucket }) {
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '4mb' }))

  // ── Auth + role gates (self-filter to /api/*; public: health, login, media GET) ──
  const { users, authGate, roleGate } = makeAuth(db)
  app.use(authGate)
  app.use(roleGate)

  const content = db.collection('content_items')
  const dayNotes = db.collection('day_notes')
  const categories = db.collection('categories')
  const teamMembers = db.collection('team_members')
  const appInfo = db.collection('app_info')
  const specialDays = db.collection('special_days')
  const locks = db.collection('period_locks')

  // Wrap async handlers so a rejection becomes a clean 500 instead of a crash.
  const wrap = (fn) => (req, res) =>
    Promise.resolve(fn(req, res)).catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e)
      res.status(500).json({ error: e?.message || 'Server error' })
    })

  const nowISO = () => new Date().toISOString()

  app.get('/api/health', (_req, res) => res.json({ ok: true, time: nowISO() }))

  // ───────────────────────── Auth ─────────────────────────
  app.post(
    '/api/auth/login',
    wrap(async (req, res) => {
      const email = String(req.body?.email || '').toLowerCase().trim()
      const password = String(req.body?.password || '')
      const user = await users.findOne({ email })
      if (!user || !(await comparePassword(password, user.passwordHash))) {
        return res.status(401).json({ error: 'Wrong email or password.' })
      }
      res.json({ token: signToken(user), user: publicUser(user) })
    }),
  )
  app.get('/api/auth/me', wrap(async (req, res) => res.json(publicUser(req.user))))

  // ───────────────────────── Users (admin only) ─────────────────────────
  app.get(
    '/api/users',
    wrap(async (req, res) => {
      if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
      const list = await users.find().toArray()
      list.sort(byName)
      res.json(list.map(publicUser))
    }),
  )
  app.post(
    '/api/users',
    wrap(async (req, res) => {
      const email = String(req.body?.email || '').toLowerCase().trim()
      const password = String(req.body?.password || '')
      const name = String(req.body?.name || '')
      const role = req.body?.role === 'admin' ? 'admin' : 'manager'
      if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' })
      if (await users.findOne({ email })) return res.status(409).json({ error: 'That email already has an account.' })
      const doc = { email, name, role, passwordHash: await hashPassword(password), created_at: nowISO() }
      const r = await users.insertOne(doc)
      res.status(201).json(publicUser({ _id: r.insertedId, ...doc }))
    }),
  )
  app.patch(
    '/api/users/:id',
    wrap(async (req, res) => {
      const _id = oid(req.params.id)
      if (!_id) return res.status(400).json({ error: 'Invalid id' })
      const patch = {}
      if (req.body?.name !== undefined) patch.name = String(req.body.name)
      if (req.body?.role !== undefined) patch.role = req.body.role === 'admin' ? 'admin' : 'manager'
      if (req.body?.password) patch.passwordHash = await hashPassword(req.body.password)
      if (patch.role === 'manager') {
        const target = await users.findOne({ _id })
        if (target?.role === 'admin' && (await users.countDocuments({ role: 'admin' })) <= 1) {
          return res.status(400).json({ error: 'Can’t remove the last admin.' })
        }
      }
      await users.updateOne({ _id }, { $set: patch })
      res.json(publicUser(await users.findOne({ _id })))
    }),
  )
  app.delete(
    '/api/users/:id',
    wrap(async (req, res) => {
      const _id = oid(req.params.id)
      if (!_id) return res.status(400).json({ error: 'Invalid id' })
      if (String(req.user._id) === String(_id)) return res.status(400).json({ error: 'You can’t delete your own account.' })
      const target = await users.findOne({ _id })
      if (target?.role === 'admin' && (await users.countDocuments({ role: 'admin' })) <= 1) {
        return res.status(400).json({ error: 'Can’t delete the last admin.' })
      }
      await users.deleteOne({ _id })
      res.status(204).end()
    }),
  )

  // ───────────────────────── Content items ─────────────────────────
  // The Overview feed: posts + reels, in grid order. (Defined before the
  // generic /api/content route so "grid" isn't read as a query.)
  app.get(
    '/api/content/grid',
    wrap(async (_req, res) => {
      const items = await content.find({ type: { $in: ['post', 'reel'] } }).toArray()
      items.sort(byGridThenDate)
      res.json(items.map(serialize))
    }),
  )

  // ?date=YYYY-MM-DD (one day) | ?start=&end= (range) | none (all)
  app.get(
    '/api/content',
    wrap(async (req, res) => {
      const { date, start, end } = req.query
      let q = {}
      if (date) q = { date }
      else if (start && end) q = { date: { $gte: start, $lte: end } }
      const items = await content.find(q).toArray()
      items.sort(byDateGridCreated)
      res.json(items.map(serialize))
    }),
  )

  app.post(
    '/api/content',
    wrap(async (req, res) => {
      const now = nowISO()
      const doc = { ...req.body, created_at: now, updated_at: now }
      delete doc.id
      delete doc._id
      const r = await content.insertOne(doc)
      res.status(201).json(serialize({ _id: r.insertedId, ...doc }))
    }),
  )

  app.patch(
    '/api/content/:id',
    wrap(async (req, res) => {
      const _id = oid(req.params.id)
      if (!_id) return res.status(400).json({ error: 'Invalid id' })
      const patch = { ...req.body, updated_at: nowISO() }
      delete patch.id
      delete patch._id
      await content.updateOne({ _id }, { $set: patch })
      res.json(serialize(await content.findOne({ _id })))
    }),
  )

  app.delete(
    '/api/content/:id',
    wrap(async (req, res) => {
      const _id = oid(req.params.id)
      if (!_id) return res.status(400).json({ error: 'Invalid id' })
      await content.deleteOne({ _id })
      // Best-effort: remove the item's uploaded photos/videos from GridFS too.
      const fromQuery = [].concat(req.query.media || []).filter(Boolean)
      const fromBody = Array.isArray(req.body?.mediaPaths) ? req.body.mediaPaths : []
      for (const p of [...fromQuery, ...fromBody]) {
        const mid = oid(p)
        if (mid) await bucket.delete(mid).catch(() => {})
      }
      res.status(204).end()
    }),
  )

  // Renumber the whole feed in one shot (grid_position = index + 1).
  app.post(
    '/api/content/grid/reorder',
    wrap(async (req, res) => {
      const ids = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds : []
      const now = nowISO()
      await Promise.all(
        ids.map((id, i) => {
          const _id = oid(id)
          return _id
            ? content.updateOne({ _id }, { $set: { grid_position: i + 1, updated_at: now } })
            : Promise.resolve()
        }),
      )
      res.status(204).end()
    }),
  )

  // ───────────────────────── Day notes (keyed by date) ─────────────────────────
  app.get(
    '/api/day-notes/:date',
    wrap(async (req, res) => {
      const doc = await dayNotes.findOne({ date: req.params.date })
      if (!doc) return res.json(null)
      const { _id, ...rest } = doc
      res.json(rest)
    }),
  )

  app.put(
    '/api/day-notes/:date',
    wrap(async (req, res) => {
      const date = req.params.date
      const note = req.body?.note ?? ''
      const updated_at = nowISO()
      await dayNotes.updateOne({ date }, { $set: { date, note, updated_at } }, { upsert: true })
      res.json({ date, note, updated_at })
    }),
  )

  // ───────────────────────── Categories ─────────────────────────
  app.get(
    '/api/categories',
    wrap(async (_req, res) => {
      const items = await categories.find().toArray()
      items.sort(byName)
      res.json(items.map(serialize))
    }),
  )
  app.post(
    '/api/categories',
    wrap(async (req, res) => {
      const doc = { name: req.body?.name ?? '', color: req.body?.color ?? '#888888', created_at: nowISO() }
      const r = await categories.insertOne(doc)
      res.status(201).json(serialize({ _id: r.insertedId, ...doc }))
    }),
  )
  app.patch(
    '/api/categories/:id',
    wrap(async (req, res) => {
      const _id = oid(req.params.id)
      if (!_id) return res.status(400).json({ error: 'Invalid id' })
      const patch = {}
      if (req.body?.name !== undefined) patch.name = req.body.name
      if (req.body?.color !== undefined) patch.color = req.body.color
      await categories.updateOne({ _id }, { $set: patch })
      res.json(serialize(await categories.findOne({ _id })))
    }),
  )
  app.delete(
    '/api/categories/:id',
    wrap(async (req, res) => {
      const _id = oid(req.params.id)
      if (_id) await categories.deleteOne({ _id })
      res.status(204).end()
    }),
  )

  // ───────────────────────── Team members ─────────────────────────
  app.get(
    '/api/team-members',
    wrap(async (_req, res) => {
      const items = await teamMembers.find().toArray()
      items.sort(byName)
      res.json(items.map(serialize))
    }),
  )
  app.post(
    '/api/team-members',
    wrap(async (req, res) => {
      const doc = { name: req.body?.name ?? '', created_at: nowISO() }
      const r = await teamMembers.insertOne(doc)
      res.status(201).json(serialize({ _id: r.insertedId, ...doc }))
    }),
  )
  app.patch(
    '/api/team-members/:id',
    wrap(async (req, res) => {
      const _id = oid(req.params.id)
      if (!_id) return res.status(400).json({ error: 'Invalid id' })
      await teamMembers.updateOne({ _id }, { $set: { name: req.body?.name ?? '' } })
      res.json(serialize(await teamMembers.findOne({ _id })))
    }),
  )
  app.delete(
    '/api/team-members/:id',
    wrap(async (req, res) => {
      const _id = oid(req.params.id)
      if (_id) await teamMembers.deleteOne({ _id })
      res.status(204).end()
    }),
  )

  // ───────────────────────── App info (single 'main' doc) ─────────────────────────
  app.get(
    '/api/app-info',
    wrap(async (_req, res) => {
      const doc = await appInfo.findOne({ key: 'main' })
      res.json(doc ? { id: 'main', content: doc.content ?? '', updated_at: doc.updated_at ?? null } : null)
    }),
  )
  app.put(
    '/api/app-info',
    wrap(async (req, res) => {
      const content = req.body?.content ?? ''
      const updated_at = nowISO()
      await appInfo.updateOne({ key: 'main' }, { $set: { key: 'main', content, updated_at } }, { upsert: true })
      res.json({ id: 'main', content, updated_at })
    }),
  )

  // ───────────────────────── Special days ─────────────────────────
  app.get(
    '/api/special-days',
    wrap(async (req, res) => {
      const { start, end } = req.query
      const q = start && end ? { date: { $gte: start, $lte: end } } : {}
      const items = await specialDays.find(q).toArray()
      items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.created_at ?? '') < (b.created_at ?? '') ? -1 : 1))
      res.json(items.map(serialize))
    }),
  )
  app.post(
    '/api/special-days',
    wrap(async (req, res) => {
      const doc = {
        date: req.body?.date,
        label: req.body?.label ?? '',
        color: req.body?.color ?? '#FBDDD4',
        created_at: nowISO(),
      }
      const r = await specialDays.insertOne(doc)
      res.status(201).json(serialize({ _id: r.insertedId, ...doc }))
    }),
  )
  app.delete(
    '/api/special-days/:id',
    wrap(async (req, res) => {
      const _id = oid(req.params.id)
      if (_id) await specialDays.deleteOne({ _id })
      res.status(204).end()
    }),
  )

  // ───────────────────────── Period locks ─────────────────────────
  app.get(
    '/api/locks',
    wrap(async (req, res) => {
      const { start, end } = req.query
      // Any lock overlapping [start, end].
      const q = start && end ? { start_date: { $lte: end }, end_date: { $gte: start } } : {}
      const items = await locks.find(q).toArray()
      res.json(items.map(serialize))
    }),
  )
  app.post(
    '/api/locks',
    wrap(async (req, res) => {
      const doc = {
        scope: req.body?.scope ?? 'range',
        start_date: req.body?.start_date,
        end_date: req.body?.end_date,
        finalized_by: req.body?.finalized_by ?? null,
        finalized_at: nowISO(),
        note: req.body?.note ?? null,
      }
      const r = await locks.insertOne(doc)
      res.status(201).json(serialize({ _id: r.insertedId, ...doc }))
    }),
  )
  app.delete(
    '/api/locks/:id',
    wrap(async (req, res) => {
      const _id = oid(req.params.id)
      if (_id) await locks.deleteOne({ _id })
      res.status(204).end()
    }),
  )

  // ───────────────────────── Media (photos/videos in GridFS) ─────────────────────────
  app.post(
    '/api/media',
    upload.single('file'),
    wrap(async (req, res) => {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
      const _id = new ObjectId()
      const stream = bucket.openUploadStreamWithId(_id, req.file.originalname, {
        contentType: req.file.mimetype,
        metadata: { name: req.file.originalname },
      })
      stream.end(req.file.buffer)
      await new Promise((resolve, reject) => {
        stream.on('finish', resolve)
        stream.on('error', reject)
      })
      const base = `${req.protocol}://${req.get('host')}`
      res.status(201).json({ url: `${base}/api/media/${_id}`, path: String(_id), name: req.file.originalname })
    }),
  )

  app.get(
    '/api/media/:id',
    wrap(async (req, res) => {
      const _id = oid(req.params.id)
      if (!_id) return res.status(400).end()
      const files = await bucket.find({ _id }).toArray()
      if (!files.length) return res.status(404).end()
      const f = files[0]
      const size = f.length
      if (f.contentType) res.set('Content-Type', f.contentType)
      res.set('Cache-Control', 'public, max-age=31536000, immutable')
      res.set('Accept-Ranges', 'bytes')

      // Honour Range requests so <video> can seek / autoplay reliably.
      const range = req.headers.range
      if (range) {
        const m = /bytes=(\d+)-(\d*)/.exec(range)
        if (m) {
          const startByte = parseInt(m[1], 10)
          const endByte = m[2] ? parseInt(m[2], 10) : size - 1
          res.status(206)
          res.set('Content-Range', `bytes ${startByte}-${endByte}/${size}`)
          res.set('Content-Length', String(endByte - startByte + 1))
          return bucket
            .openDownloadStream(_id, { start: startByte, end: endByte + 1 })
            .on('error', () => res.end())
            .pipe(res)
        }
      }
      res.set('Content-Length', String(size))
      bucket.openDownloadStream(_id).on('error', () => res.status(404).end()).pipe(res)
    }),
  )

  app.delete(
    '/api/media/:id',
    wrap(async (req, res) => {
      const _id = oid(req.params.id)
      if (_id) await bucket.delete(_id).catch(() => {})
      res.status(204).end()
    }),
  )

  return app
}

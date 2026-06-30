// Authentication helpers: bcrypt password hashing, JWT issue/verify, the
// auth/role gate middleware, and first-admin bootstrap.
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { ObjectId } from 'mongodb'

const SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me'
const EXPIRES = '30d'

if (!process.env.JWT_SECRET) {
  // eslint-disable-next-line no-console
  console.warn('⚠ JWT_SECRET not set — using an insecure dev secret. Set it in server/.env for production.')
}

export const hashPassword = (pw) => bcrypt.hash(String(pw), 10)
export const comparePassword = (pw, hash) => bcrypt.compare(String(pw), String(hash))

export function signToken(user) {
  return jwt.sign(
    { sub: String(user._id ?? user.id), role: user.role, email: user.email },
    SECRET,
    { expiresIn: EXPIRES },
  )
}
function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET)
  } catch {
    return null
  }
}

/** Strip the password hash before sending a user to the client. */
export function publicUser(u) {
  if (!u) return null
  return {
    id: String(u._id ?? u.id),
    email: u.email,
    name: u.name ?? '',
    role: u.role === 'admin' ? 'admin' : 'manager',
    created_at: u.created_at ?? null,
  }
}

function bearer(req) {
  const h = req.headers.authorization || ''
  return h.startsWith('Bearer ') ? h.slice(7) : null
}

const oid = (id) => {
  try {
    return new ObjectId(String(id))
  } catch {
    return null
  }
}

/** Build the gate middleware bound to this db's users collection. */
export function makeAuth(db) {
  const users = db.collection('users')

  // Verify the JWT and attach req.user. 401 if missing/invalid.
  async function requireAuth(req, res, next) {
    const payload = verifyToken(bearer(req))
    const _id = payload && oid(payload.sub)
    const user = _id && (await users.findOne({ _id }))
    if (!user) return res.status(401).json({ error: 'Please sign in.' })
    req.user = user
    next()
  }

  // Routes that need no auth: health, login, and media reads (so <img> works).
  function isPublic(req) {
    if (req.method === 'GET' && req.path === '/api/health') return true
    if (req.method === 'POST' && req.path === '/api/auth/login') return true
    if (req.method === 'GET' && /^\/api\/media\/[^/]+$/.test(req.path)) return true
    return false
  }

  // Gate 1: everything under /api requires a valid session except public routes.
  function authGate(req, res, next) {
    if (!req.path.startsWith('/api/')) return next()
    if (isPublic(req)) return next()
    return requireAuth(req, res, next)
  }

  // Gate 2: role enforcement. Reads are fine for any signed-in user. Writes are
  // admin-only — EXCEPT a manager may PATCH a content item's status.
  function roleGate(req, res, next) {
    if (!req.path.startsWith('/api/')) return next()
    if (isPublic(req) || req.method === 'GET') return next()
    if (req.user?.role === 'admin') return next()
    if (req.method === 'PATCH' && /^\/api\/content\/[^/]+$/.test(req.path)) {
      const keys = Object.keys(req.body || {})
      if (keys.length && keys.every((k) => k === 'status')) return next()
    }
    return res.status(403).json({ error: 'You don’t have permission to do that.' })
  }

  return { users, requireAuth, authGate, roleGate }
}

/** Create the first admin from env (ADMIN_EMAIL/ADMIN_PASSWORD) if no users exist. */
export async function ensureDefaultAdmin(db, { email, password, name } = {}) {
  const users = db.collection('users')
  await users.createIndex({ email: 1 }, { unique: true }).catch(() => {})
  if ((await users.countDocuments()) > 0) return null
  if (!email || !password) return null
  const doc = {
    email: String(email).toLowerCase().trim(),
    name: name || 'Admin',
    role: 'admin',
    passwordHash: await hashPassword(password),
    created_at: new Date().toISOString(),
  }
  await users.insertOne(doc).catch(() => {})
  return doc
}

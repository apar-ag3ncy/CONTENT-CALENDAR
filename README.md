# Chheda's × Apar — Content Calendar

A shared social-media content calendar for the marketing team. Plan **Posts
(static or carousel), Reels, Stories and Captions** for each day, upload the
media, and see the whole Instagram feed come together in **Grid Review**.

It runs on a **MongoDB** backend (data **and** photos live in MongoDB Atlas) and
has **no login** — anyone you share the link with can view and edit. This README
is written so a **non-developer** can set it up.

## The workflow it supports

1. **One person plans.** They add posts / reels / carousels / stories / captions
   to each day, upload the photos, and check **Grid Review** to see exactly how
   the future Instagram grid will look.
2. **The Instagram managers post from it.** They open the same app (it reads the
   same database), follow the calendar + Grid Review, and post each item on the
   planned day — flipping its status to **Posted** as they go.

---

## What you need

- A free **MongoDB Atlas** account → <https://www.mongodb.com/atlas>
- **Node.js** (LTS) → <https://nodejs.org>
- *(to put it online)* a **Vercel** account (front-end) + a host like **Render**
  for the API

## Two parts: the app + the backend

```
Front-end (this folder, Vite)  ──HTTP──▶  API (/server, Express)  ──▶  MongoDB Atlas
```

### 1. Start the backend (MongoDB API)

Full step-by-step (incl. creating the free Atlas database) is in
[`server/README.md`](server/README.md). The short version:

```bash
cd server
cp .env.example .env        # paste your Atlas connection string into MONGODB_URI
npm install
npm run seed                # optional: load the 2 sample days + photos into Atlas
npm start                   # → http://localhost:4000
```

> **No Atlas account yet?** Run `npm run dev:memory` instead — it starts an
> in-memory MongoDB + the API (pre-seeded) so you can try everything locally.
> Data resets on restart; use a real Atlas URI for shared, persistent data.

### 2. Start the app (front-end)

In this root folder:

```bash
cp .env.example .env.local  # sets VITE_API_URL=http://localhost:4000
npm install
npm run dev                 # → http://localhost:5173
```

That's it — the calendar now reads & writes live data, and uploaded photos are
stored in MongoDB.

> Leave `VITE_API_URL` unset to run in read-only **demo mode** (sample data
> only, no backend needed).

---

## Put it online

- **API** → deploy the `server/` folder to Render / Railway / Fly.io. Set
  `MONGODB_URI`, `DB_NAME`, `PUBLIC_URL` (your API's https URL). See
  [`server/README.md`](server/README.md).
- **Front-end** → import this repo into Vercel (auto-detects Vite). Set
  **Environment Variable** `VITE_API_URL` = your API's public URL. `vercel.json`
  already handles page refreshes.
- In Atlas → **Network Access**, allow your host's IPs (or `0.0.0.0/0`).

> ⚠️ "No login" means *anyone with the link* can edit — fine for an internal
> tool. For a light gate, turn on Vercel **Password Protection** (one shared
> password).

---

## How to use it

- **Pick a month** in the left menu → the sidebar fills with the dates. Click a
  date to open it.
- On a day, use **+ Add a Post / Reel / Story / Caption**. Posts can be
  **Static** or **Carousel**. Drag files onto the upload box or click to browse;
  you can also paste a **Google Drive link**.
- **Grid Review** (top of the sidebar) shows all Posts + Reels as an
  Instagram-style grid, plus a per-day plan of every post, reel & story.
- **Lock this month / week** finalizes a plan and shows a **"✅ Locked — follow
  this plan"** banner (advisory — there are no roles to enforce it).
- **Categories & info** manages colour tags, team members (for "Assigned to"),
  and a shared notice board.

---

## Project layout

```
.
├── index.html · package.json · vite.config.ts · vercel.json
├── tailwind.config.js          # warm theme + forest-green Grid Review tokens
├── .env.local                  # VITE_API_URL (git-ignored)
├── server/                     # the MongoDB API (Express + GridFS)
│   ├── app.js · index.js       # routes + entry
│   ├── seed.js · dev-memory.mjs · test-smoke.mjs
│   └── README.md               # Atlas setup
└── src/
    ├── App.tsx · main.tsx · index.css
    ├── components/              # AppShell, DayContent, ContentForm, DropZone, …
    ├── pages/                   # Year / Month / Week / Day / Grid Review / Settings / Landing
    ├── hooks/                   # React Query reads + writes (call the API)
    ├── lib/api.ts               # the API client (isApiConfigured + fetch helpers)
    └── types/database.ts        # document types
```

---

## Common commands

| Where | Command | What it does |
| --- | --- | --- |
| root | `npm run dev` | Run the app locally. |
| root | `npm run build` | Build the production app (used by Vercel). |
| server | `npm start` | Run the API against your Atlas database. |
| server | `npm run dev:memory` | Run the API on an in-memory MongoDB (no Atlas needed). |
| server | `npm run seed` | Load the 2 sample days + photos into the database. |
| server | `npm test` | Boot an in-memory MongoDB and exercise every endpoint. |

---

## Build progress

- [x] Calendar (Year / Month / Week) + per-day content tabs
- [x] Add/edit form, Drive links, status tracking, team & categories
- [x] Finalize / lock + "follow this plan" banner
- [x] App shell (sidebar index + centered content)
- [x] Grid Review — Instagram-style feed + per-day plan
- [x] **MongoDB backend** — data + photos (GridFS), no login, shared
- [ ] Deploy (API on Render + front-end on Vercel)

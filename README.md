# Chheda's × Apar — Content Calendar

A shared social-media content calendar for the marketing team. Plan **Posts
(static or carousel), Reels, Stories and Captions** for each day, upload the
media, and see the whole Instagram feed come together in one **Overview**.

It runs on **Firebase** (Firestore + Storage) and has **no login** — anyone you
share the link with can view and edit. This README is written so a
**non-developer** can set it up.

---

## What you need

- A **Firebase** account → <https://firebase.google.com> (the project
  `content-calendar-341c5` is already created for this app)
- A **Vercel** account to put it online → <https://vercel.com>
- **Node.js** (LTS) to run it locally → <https://nodejs.org>

---

## Part A — Turn on Firebase (one-time)

In the **Firebase Console** (<https://console.firebase.google.com>) → open your
project:

1. **Create the database** — left menu **Build → Firestore Database → Create
   database** → choose a region → **Start in test mode** → Enable.
2. **Open it up (no login)** — Firestore Database → **Rules** tab → paste the
   contents of [`firestore.rules`](firestore.rules) → **Publish**.
3. **Turn on file storage** — **Build → Storage → Get started** → accept the
   default bucket → then its **Rules** tab → paste
   [`storage.rules`](storage.rules) → **Publish**.

That's it — the app can now read, write, and store uploads.

> ⚠️ **Heads-up.** "No login" means *anyone with the link* can edit. That's fine
> for an internal tool. If you want a light gate later, turn on Vercel **Password
> Protection** (one shared password) or add Firebase Auth.

### Your keys

The Firebase web config is already in [`.env.local`](.env.local) (it's safe to
expose — your data is protected by the Rules above, not by hiding these keys). To
use a different project, copy [`.env.example`](.env.example) to `.env.local` and
paste your own config from **Project settings → General → Your apps → SDK setup**.

---

## Part B — Run it on your computer

```bash
npm install
npm run dev
```

Open the link it prints (usually <http://localhost:5173>). With Firebase set up,
the calendar loads and saves live.

---

## Part C — Put it online (Vercel)

1. Push this project to a GitHub repo.
2. <https://vercel.com> → **Add New… → Project** → import the repo (Vercel
   auto-detects Vite).
3. Under **Environment Variables**, add the seven `VITE_FIREBASE_*` values from
   your `.env.local`.
4. **Deploy** → you get a public link to share. `vercel.json` already handles
   page refreshes.
5. *(Recommended)* In Firebase Console → **Authentication → Settings → Authorized
   domains**, add your Vercel domain (needed if you ever add login).

---

## How to use it

- **Pick a month** in the left menu → the sidebar fills with every date
  ("1st June · Monday"). Click a date to open it.
- On a day, use **+ Add a Post / Reel / Story / Caption**. Posts can be
  **Static** or **Carousel** (carousels take several photos). Drag files onto the
  upload box or click to browse; you can also paste a **Google Drive link**.
- **Overview** (top of the sidebar, or "Overview (feed)" in the menu) shows all
  Posts + Reels as an Instagram-style grid you can **drag to reorder**.
- **Lock this month / week** finalizes a plan and shows a **"✅ Locked — follow
  this plan"** banner for everyone (advisory — there are no roles to enforce it).
- **Categories** manages colour tags; **Info & team** holds team members (for the
  "Assigned to" picker) and a shared notice board.

---

## Project layout

```
.
├── index.html · package.json · vite.config.ts · vercel.json
├── tailwind.config.js          # orange + white theme
├── .env.local                  # your Firebase web config (git-ignored)
├── firestore.rules             # open Firestore rules (publish in Console)
├── storage.rules               # open Storage rules (publish in Console)
└── src/
    ├── App.tsx · main.tsx · index.css
    ├── components/
    │   ├── AppShell.tsx         # sidebar + centered content
    │   ├── MonthIndex.tsx       # the month's dates list (left sidebar)
    │   ├── DayContent.tsx       # a day's posts/reels/stories/captions
    │   ├── ContentForm.tsx      # add/edit form (Static/Carousel, uploads)
    │   ├── DropZone.tsx         # reusable drag-and-drop uploader (Storage)
    │   └── FinalizeBar.tsx · Modal.tsx · …
    ├── pages/                   # Year / Month / Week / Day / Overview / Settings
    ├── hooks/                   # Firestore reads + writes (React Query)
    ├── lib/firebase.ts          # Firebase init (Firestore + Storage)
    └── types/database.ts        # document types
```

---

## Common commands

| Command | What it does |
| --- | --- |
| `npm install` | Download everything (run once). |
| `npm run dev` | Run locally for testing. |
| `npm run build` | Build the production version (used by Vercel). |
| `npm run preview` | Preview the production build locally. |

---

## Build progress

- [x] Calendar (Year / Month / Week) + the per-day content tabs
- [x] Add/edit form, Drive links, status tracking, team & categories
- [x] Finalize / lock + "follow this plan" banner
- [x] App shell (sidebar index + centered content)
- [x] **Firebase** (Firestore + Storage) — no login, open access
- [x] **Month dates index in the sidebar** + spacious day view
- [x] Posts as **Static / Carousel** + **drag-and-drop uploads**
- [ ] Deploy to Vercel (+ optional shared-password gate)

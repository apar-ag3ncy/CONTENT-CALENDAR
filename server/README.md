# Content-Calendar API (MongoDB Atlas backend)

A small Express + MongoDB API that stores all the calendar **data** and the
uploaded **photos/videos** (in MongoDB via GridFS). The front-end (one folder
up) reads & writes through this API, so everyone who opens the app sees the same
live plan.

```
Planner ─┐
         ├─▶  Front-end (Vite)  ──HTTP──▶  this API  ──▶  MongoDB Atlas
IG team ─┘                                              (data + photos in GridFS)
```

## The team workflow it supports

1. **One person plans.** They open the app, add posts / reels / carousels /
   stories / captions to each day, upload the photos, and check **Grid Review**
   to see exactly how the future Instagram grid will look.
2. **The Instagram managers post from it.** They open the same app (it reads the
   same database), follow the calendar and Grid Review, and post each item on
   Instagram on the planned day — flipping its status to **Posted** as they go.

No login — anyone with the app URL can view and edit (internal tool).

---

## 1. Create a free MongoDB Atlas database (5 min)

1. Go to <https://www.mongodb.com/atlas> and sign up / log in.
2. **Build a Database** → **M0 (Free)** → pick a cloud/region → **Create**.
3. **Database Access** → **Add New Database User** → username + password
   (write it down). Give it "Read and write to any database".
4. **Network Access** → **Add IP Address** → for testing use **Allow access from
   anywhere** (`0.0.0.0/0`); tighten later for production.
5. **Connect** → **Drivers** → copy the connection string. It looks like:
   `mongodb+srv://<user>:<db_password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`

## 2. Configure & run the API

```bash
cd server
cp .env.example .env          # then edit .env:
#   MONGODB_URI = the string from Atlas (replace <db_password> with the real one)
#   DB_NAME     = content_calendar   (keep as-is)
npm install
npm run seed                  # optional: load the 2 sample days + photos into Atlas
npm start                     # → http://localhost:4000
```

## 3. Point the front-end at it

In the **project root** (one folder up), create `.env.local`:

```
VITE_API_URL=http://localhost:4000
```

Then run the front-end (`npm run dev` in the root). Done — the calendar now
reads & writes real data, and uploaded photos are stored in MongoDB.

> Leave `VITE_API_URL` unset to run the app in read-only **demo mode** (sample
> data only, no backend needed).

---

## Try it with NO Atlas account (in-memory)

Want to test the whole thing first without signing up for Atlas?

```bash
cd server && npm install
npm run dev:memory     # starts an in-memory MongoDB + the API on :4000, pre-seeded
```

Set `VITE_API_URL=http://localhost:4000` and run the front-end. Everything works
(data + photo upload), but the data resets when you stop the server. Use a real
Atlas URI (`npm start`) for persistent, shared data.

## Verify the API

```bash
npm test               # boots an in-memory MongoDB and exercises every endpoint
```

---

## Deploying (so the team can share it online)

- **API** → host this `server/` folder on Render / Railway / Fly.io (free tiers
  work). Set the env vars `MONGODB_URI`, `DB_NAME`, and `PUBLIC_URL`
  (your API's public https URL). Start command: `npm start`.
- **Front-end** → deploy the root app to Vercel/Netlify with
  `VITE_API_URL` set to your API's public URL.
- In Atlas **Network Access**, allow your host's IPs (or `0.0.0.0/0`).

## API reference (all under `/api`)

| Area | Endpoints |
|------|-----------|
| Content | `GET /content?date=` · `GET /content?start=&end=` · `GET /content/grid` · `POST /content` · `PATCH /content/:id` · `DELETE /content/:id` · `POST /content/grid/reorder` |
| Day notes | `GET /day-notes/:date` · `PUT /day-notes/:date` |
| Categories | `GET/POST /categories` · `PATCH/DELETE /categories/:id` |
| Team members | `GET/POST /team-members` · `PATCH/DELETE /team-members/:id` |
| Shared info | `GET /app-info` · `PUT /app-info` |
| Special days | `GET /special-days?start=&end=` · `POST /special-days` · `DELETE /special-days/:id` |
| Locks | `GET /locks?start=&end=` · `POST /locks` · `DELETE /locks/:id` |
| Media (photos) | `POST /media` (multipart `file`) · `GET /media/:id` (streams, supports Range) · `DELETE /media/:id` |

Mongo `_id`s are returned to the front-end as string `id`s (Firestore-style), so
the existing UI works unchanged. Photos are stored in the `media` GridFS bucket
and served from `GET /api/media/:id`.

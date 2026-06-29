# Deploy to cPanel (PHP + SQLite)

The whole app runs on plain cPanel shared hosting — **no Node.js, no MySQL, no
database credentials**:

- **Frontend** — the built React app (static files) in the site's document root
- **API** — one PHP front controller, `api/index.php`
- **Database** — **SQLite**: a single file at `api/data/calendar.sqlite`, created
  automatically on first request (along with all 7 tables). Nothing to set up.
- **Media** — uploaded photos/videos as files in `media/`, served by Apache

> Why SQLite? GoDaddy's MariaDB stores DB-user passwords with the `ed25519` auth
> plugin, which PHP/PDO can't authenticate (every connect → `1045 Access denied`,
> even with the correct password), and shared-hosting users can't change it.
> SQLite sidesteps all of that — no user, no password, nothing for the host to
> block. The repo also keeps a Node + MongoDB backend in `server/`; it is **not**
> used for the cPanel deploy.

```
<document root>/
├── index.html · assets/    ← built frontend
├── .htaccess               ← SPA routing (ships from public/.htaccess)
├── api/
│   ├── index.php           ← front controller (all REST routes)
│   ├── .htaccess           ← routes /api/* → index.php
│   ├── config.php          ← media paths + CORS (no secrets)
│   └── data/               ← SQLite db lives here (auto-created, git-ignored)
└── media/                  ← uploads land here (auto-created; make it 755)
```

## First-time deploy

1. **Build:** `npm install && npm run build` with `VITE_SAME_ORIGIN=1` (set in
   `.env.production`). This also bundles `content-calendar-cpanel.zip` — the whole
   document-root layout, ready to extract.
2. **Subdomain (optional):** cPanel → Domains → create e.g. `calendar.yourdomain.com`;
   if its DNS is managed elsewhere, add an A record `calendar → <hosting IP>`.
3. **Upload:** File Manager → the document root → upload the zip → **Extract**.
4. **Permissions:** set `media/` (and `api/data/` if present) to **755** so PHP can
   write to them.
5. **HTTPS:** cPanel → SSL/TLS Status → Run AutoSSL.
6. **Test:** `https://your-domain/api/health` → `{"ok":true,"engine":"sqlite"}`,
   then open `https://your-domain/` — it just works.

## Updating later

Rebuild and re-upload — but **do NOT delete the `api` folder**, because
`api/data/` holds your live database. The deploy zip deliberately **excludes
`api/data/`**, so extracting over the existing files replaces the app and API
without touching your data. Any new database columns migrate themselves on the
next request. Hard-refresh the browser (Ctrl/Cmd+Shift+R) after updating.

## Large video uploads

Default PHP limits (~64–128 MB) can reject big videos. cPanel → **MultiPHP INI
Editor** → your domain → raise `upload_max_filesize` and `post_max_size` (e.g.
`512M`) and `max_execution_time` (e.g. `300`).

## Backups

Everything is just files: the single `api/data/calendar.sqlite` (all planning)
and the `media/` folder (all photos/videos). Download them from File Manager, or
rely on cPanel's backups.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `/api/health` shows PHP source | PHP not enabled for the domain (cPanel MultiPHP Manager). |
| `/api/health` 404s | `api/.htaccess` missing or `mod_rewrite` off. |
| "Data folder is not writable" | `chmod 755 api/data` (and `media`). |
| App stuck on the "sample data" banner | Built without `VITE_SAME_ORIGIN=1`. Rebuild. |
| Refreshing a deep URL 404s | Root `.htaccess` missing from the document root. |
| Uploads fail on big files | Raise PHP limits (above). |

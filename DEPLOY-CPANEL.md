# Deploy to cPanel (PHP + SQLite)

The whole app runs on plain cPanel shared hosting — **no Node.js, no MySQL, no
database credentials**:

- **Frontend** — the built React app (static files) in the site's document root
- **API** — one PHP front controller, `api/index.php`
- **Database** — **SQLite**: a single file at `api/data/calendar.sqlite`, created
  automatically on first request (with all tables). Nothing to set up.
- **Media** — uploaded photos/videos as files in `media/`, served by Apache
- **Access control** — Apar-team and client logins, each client an isolated
  workspace. One **one-time** setup step in `api/config.php` (see below).

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
│   ├── config.php          ← first-run setup: admin login, secret_key, seed client
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
5. **Access control setup (required):** copy `api/config.sample.php` to
   `api/config.php` and fill in the one-time values (see the next section).
6. **HTTPS:** cPanel → SSL/TLS Status → Run AutoSSL.
7. **Test:** `https://your-domain/api/health` →
   `{"ok":true,"engine":"sqlite","crypto":"openssl","hasAdmin":true}`, then open
   `https://your-domain/` — you'll be asked to sign in.

## Access control & first-run setup

The app has two kinds of login, on two separate URLs:

- **Clients** sign in at the **home page** (`https://your-domain/`). One login per
  client = one private calendar. Clients can view and **review** (approve / request
  changes / comment) but cannot edit content, and never see another client's work.
- **Apar Team** signs in at **`/admin`** (`https://your-domain/admin`). Individual
  logins; can edit every client's calendar, switch between client workspaces, and
  **see/edit each client's password**. Each page rejects the other's credentials.

**One-time setup** — before the first visit, create `api/config.php` (copy
`api/config.sample.php`) and set:

| Key | What it does |
|---|---|
| `admin_username` / `admin_password` | The first Apar Team login. Set a strong password — login stays disabled until it's set. |
| `secret_key` | A long random string used to **reversibly encrypt client passwords** so the team can view them. Use 64+ random hex chars. |
| `seed_client_name` / `seed_client_username` / `seed_client_password` | The first client workspace, which **adopts any existing calendar data** on first run. |

On the **first request** the API creates the admin + first client and migrates
existing data into that client. After that, sign in as the admin and create more
team members and clients from the app (**Account menu → Team accounts / Clients**).
The config values are ignored once accounts exist; you can blank them out.

> **Why client passwords are recoverable, not hashed:** the team must be able to
> *see and share* a client's password (an explicit requirement), so client
> passwords are AES-encrypted with `secret_key` and decrypted only for team
> requests. They live inside `api/data/` which is **not web-reachable**
> (`api/data/.htaccess` denies all). Team passwords are one-way hashed. Keep
> `secret_key` secret and back it up — losing it makes stored client passwords
> unreadable (they show blank in the Clients page with a "set a new password"
> hint). With `secret_key` set, encryption is **required**: if the host lacks the
> `openssl` extension the API refuses to store a password rather than silently
> writing it in cleartext. (`/api/health` reports `"crypto":"openssl"` when
> available.) Only if you leave `secret_key` blank does it fall back to plaintext
> storage in the non-web SQLite file.

> **Authorization header:** `api/.htaccess` re-exposes the `Authorization` header
> to PHP (GoDaddy/PHP-FPM often strips it, which would silently break login). It
> ships configured — no action needed.

## Updating later

Rebuild and re-upload — but **do NOT delete the `api` folder**, because
`api/data/` holds your live database **and `api/config.php` holds your
`secret_key`** (needed to read client passwords). The deploy zip deliberately
**excludes `api/data/` and `api/config.php`**, so extracting over the existing
files replaces the app and API without touching your data or secrets. Any new
database columns migrate themselves on the next request. Hard-refresh the browser
(Ctrl/Cmd+Shift+R) after updating.

## Large video uploads

Default PHP limits (~64–128 MB) can reject big videos. cPanel → **MultiPHP INI
Editor** → your domain → raise `upload_max_filesize` and `post_max_size` (e.g.
`512M`) and `max_execution_time` (e.g. `300`).

## Backups

Everything is just files: `api/data/calendar.sqlite` (all planning + accounts),
the `media/` folder (all photos/videos), and `api/config.php` (your `secret_key`).
Download them from File Manager, or rely on cPanel's backups. **Back up
`api/config.php` too** — without its `secret_key` the stored client passwords
can't be decrypted.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `/api/health` shows PHP source | PHP not enabled for the domain (cPanel MultiPHP Manager). |
| `/api/health` 404s | `api/.htaccess` missing or `mod_rewrite` off. |
| "Data folder is not writable" | `chmod 755 api/data` (and `media`). |
| App stuck on the "sample data" banner | Built without `VITE_SAME_ORIGIN=1`. Rebuild. |
| Refreshing a deep URL 404s | Root `.htaccess` missing from the document root. |
| Uploads fail on big files | Raise PHP limits (above). |
| Can't log in / "Invalid username or password" for the admin | `admin_password` not set in `api/config.php` before the first request. Set it; if the DB was already created without an admin, also delete `api/data/calendar.sqlite` (only safe on a brand-new install) or add the admin via SQLite. `/api/health` shows `"hasAdmin":false` when no admin exists. |
| Login works locally but fails on the server (401 right after sign-in) | The `Authorization` header is being stripped. Confirm `api/.htaccess` shipped intact (it contains the `HTTP_AUTHORIZATION` rewrite). |
| Client passwords show blank in the Clients page | `secret_key` changed or lost since they were saved. Re-set each client's password. |

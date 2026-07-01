<?php
// -----------------------------------------------------------------------------
// Content-calendar API — PHP + SQLite, for cPanel hosting.
// Single front controller: api/.htaccess routes every /api/* request here.
//
// SQLite means NO database server, user, or password — the data lives in a file
// (api/data/calendar.sqlite) on your cPanel disk. The file + tables are created
// automatically on first run.
//
// Multi-tenant + access control:
//   • Apar TEAM users (individual logins) can switch between every client
//     workspace and edit everything. They can also see/edit client passwords.
//   • CLIENT users have ONE workspace each and can only view + review (approve /
//     request changes / comment) — they cannot edit content.
// Each client = an isolated workspace; every data row is scoped by client_id.
//
// Photos/videos are stored as files on disk (default public_html-side media/)
// and served directly by Apache at /media/<file>.
// -----------------------------------------------------------------------------
declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '0');

// ── Config (optional — media + CORS + first-run setup secrets) ──
$CONFIG = is_file(__DIR__ . '/config.php') ? require __DIR__ . '/config.php' : [];
if (!is_array($CONFIG)) {
    $CONFIG = [];
}
$MEDIA_DIR    = rtrim((string) ($CONFIG['media_dir'] ?? (__DIR__ . '/../media')), '/');
$MEDIA_URL    = rtrim((string) ($CONFIG['media_url'] ?? '/media'), '/');
$ALLOW_ORIGIN = (string) ($CONFIG['allow_origin'] ?? '*');
// Where the SQLite database file lives (kept out of the web root by data/.htaccess).
$DB_FILE = (string) ($CONFIG['db_file'] ?? (__DIR__ . '/data/calendar.sqlite'));
// Secret used to reversibly encrypt client passwords so the team can view them.
$SECRET_KEY = (string) ($CONFIG['secret_key'] ?? '');
// How long a login stays valid (sliding — refreshed on each request).
$SESSION_TTL_DAYS = (int) ($CONFIG['session_ttl_days'] ?? 14);

// ── Helpers ──
function send_json($data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}
function no_content(): void
{
    http_response_code(204);
    exit;
}
function fail(string $message, int $code = 400): void
{
    send_json(['error' => $message], $code);
}
function body_json(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}
function new_id(): string
{
    return bin2hex(random_bytes(12));
}
function new_token(): string
{
    return bin2hex(random_bytes(32));
}
function now_iso(): string
{
    $t = microtime(true);
    $ms = (int) floor(($t - floor($t)) * 1000);
    return gmdate('Y-m-d\TH:i:s', (int) $t) . sprintf('.%03dZ', $ms);
}
function iso_plus_days(int $days): string
{
    return gmdate('Y-m-d\TH:i:s', time() + $days * 86400) . '.000Z';
}

// ── Reversible secret (client passwords) ─────────────────────────────────────
// Team must be able to READ a client's password, so it can't be one-way hashed.
// We encrypt it with AES-256-CBC using the config secret_key. If the host lacks
// openssl, we transparently fall back to a plaintext store (still inside the
// non-web-reachable SQLite file). Stored values are self-describing via a prefix.
function enc_secret(string $plain): string
{
    global $SECRET_KEY;
    if ($SECRET_KEY !== '') {
        // A key is configured → we MUST encrypt. Never silently downgrade to a
        // plaintext store (that would write the client's real password in the
        // clear despite the operator asking for encryption). Fail closed instead.
        if (!function_exists('openssl_encrypt')) {
            error_log('enc_secret: secret_key set but openssl extension unavailable');
            throw new RuntimeException('Encryption unavailable on this server');
        }
        $key = hash('sha256', $SECRET_KEY, true);
        $iv  = random_bytes(16);
        $ct  = openssl_encrypt($plain, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
        if ($ct === false) {
            error_log('enc_secret: openssl_encrypt failed');
            throw new RuntimeException('Encryption failed');
        }
        return 'enc:' . base64_encode($iv . $ct);
    }
    // No key configured → documented plaintext fallback (DB is non-web-reachable).
    return 'plain:' . $plain;
}
/** Decrypt a stored secret. Returns null when an 'enc:' value can't be decrypted
 *  (lost/changed secret_key, missing openssl) so callers can tell that apart from
 *  a genuinely empty password. */
function dec_secret(string $stored): ?string
{
    global $SECRET_KEY;
    if (strncmp($stored, 'enc:', 4) === 0) {
        if (!function_exists('openssl_decrypt') || $SECRET_KEY === '') {
            return null;
        }
        $key = hash('sha256', $SECRET_KEY, true);
        $raw = base64_decode(substr($stored, 4), true);
        if ($raw === false || strlen($raw) < 17) {
            return null;
        }
        $iv  = substr($raw, 0, 16);
        $out = openssl_decrypt(substr($raw, 16), 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
        return $out === false ? null : $out;
    }
    if (strncmp($stored, 'plain:', 6) === 0) {
        return substr($stored, 6);
    }
    return $stored; // legacy / unprefixed
}

/** Validate a CSS hex colour (#rgb … #rrggbbaa); returns null if not one. */
function clean_hex($v): ?string
{
    $v = is_string($v) ? trim($v) : '';
    return preg_match('/^#[0-9a-fA-F]{3,8}$/', $v) ? $v : null;
}

/** Serialize a client row (optionally with its decrypted password). */
function hydrate_client(array $r, bool $withPassword = false): array
{
    $out = [
        'id'          => $r['id'],
        'name'        => $r['name'],
        'username'    => $r['username'],
        'status'      => $r['status'],
        'brand_color' => $r['brand_color'] ?? null,
        'text_color'  => $r['text_color'] ?? null,
        'bg_color'    => $r['bg_color'] ?? null,
        'created_at'  => $r['created_at'] ?? null,
        'updated_at'  => $r['updated_at'] ?? null,
    ];
    if ($withPassword) {
        $out['password'] = dec_secret($r['password_enc']);
    }
    return $out;
}

// ── Schema ───────────────────────────────────────────────────────────────────
function ensure_column(PDO $db, string $table, string $col, string $ddl): void
{
    $cols = $db->query("PRAGMA table_info($table)")->fetchAll(PDO::FETCH_COLUMN, 1);
    if (!in_array($col, $cols, true)) {
        $db->exec("ALTER TABLE $table ADD COLUMN $ddl");
    }
}

function init_schema(PDO $db): void
{
    $db->exec(<<<SQL
CREATE TABLE IF NOT EXISTS content_items (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  day_of_week TEXT,
  type TEXT NOT NULL,
  post_format TEXT,
  media_type TEXT,
  media TEXT,
  title TEXT,
  caption TEXT,
  drive_link TEXT,
  category_id TEXT,
  status TEXT NOT NULL DEFAULT 'idea',
  assigned_to TEXT,
  notes TEXT,
  grid_position INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS special_days (
  id TEXT PRIMARY KEY, date TEXT NOT NULL, label TEXT NOT NULL, color TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sd_date ON special_days(date);
CREATE TABLE IF NOT EXISTS period_locks (
  id TEXT PRIMARY KEY, scope TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL,
  finalized_by TEXT, finalized_at TEXT NOT NULL, note TEXT
);
-- day_notes: NEW shape (surrogate id + per-client uniqueness). On databases that
-- still have the OLD shape (PRIMARY KEY date), the rebuild in bootstrap converts it.
CREATE TABLE IF NOT EXISTS day_notes (
  id TEXT PRIMARY KEY, client_id TEXT NOT NULL, date TEXT NOT NULL, note TEXT NOT NULL,
  drive_link TEXT, updated_by TEXT, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS app_info (
  id TEXT PRIMARY KEY, content TEXT NOT NULL, updated_at TEXT NOT NULL
);

-- ── Access control + multi-tenancy ──
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE,
  password_enc TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS team_users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, user_kind TEXT NOT NULL, user_id TEXT NOT NULL,
  client_id TEXT, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, last_seen TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS content_comments (
  id TEXT PRIMARY KEY, client_id TEXT NOT NULL, content_id TEXT NOT NULL,
  author_kind TEXT NOT NULL, author_id TEXT NOT NULL, author_name TEXT,
  body TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_item ON content_comments(client_id, content_id);
SQL);

    // Legacy migration: pre-existing day_notes may lack drive_link.
    $dnCols = $db->query("PRAGMA table_info(day_notes)")->fetchAll(PDO::FETCH_COLUMN, 1);
    if (!in_array('drive_link', $dnCols, true)) {
        $db->exec("ALTER TABLE day_notes ADD COLUMN drive_link TEXT");
    }

    // Scope every data table by client_id (added nullable; back-filled in bootstrap).
    foreach (['content_items', 'categories', 'special_days', 'period_locks', 'team_members', 'app_info'] as $t) {
        ensure_column($db, $t, 'client_id', 'client_id TEXT');
        $db->exec("CREATE INDEX IF NOT EXISTS idx_{$t}_client ON $t(client_id)");
    }
    // Per-item client review state (1:1 with the item).
    ensure_column($db, 'content_items', 'approval_state', "approval_state TEXT NOT NULL DEFAULT 'pending'");
    ensure_column($db, 'content_items', 'approval_updated_at', 'approval_updated_at TEXT');
    ensure_column($db, 'content_items', 'approval_updated_by', 'approval_updated_by TEXT');

    // Per-client brand theme (drives the whole app's colours for that workspace).
    ensure_column($db, 'clients', 'brand_color', 'brand_color TEXT');
    ensure_column($db, 'clients', 'text_color', 'text_color TEXT');
    ensure_column($db, 'clients', 'bg_color', 'bg_color TEXT');

    // Per-day client notes / suggestions thread (client posts; team replies + acks).
    $db->exec(
        "CREATE TABLE IF NOT EXISTS day_comments (
           id TEXT PRIMARY KEY, client_id TEXT NOT NULL, date TEXT NOT NULL,
           author_kind TEXT NOT NULL, author_id TEXT, author_name TEXT, body TEXT NOT NULL,
           acknowledged INTEGER NOT NULL DEFAULT 0, acknowledged_by TEXT, created_at TEXT NOT NULL
         )"
    );
    $db->exec("CREATE INDEX IF NOT EXISTS idx_day_comments ON day_comments(client_id, date)");

    // Indexes are created AFTER the column guards, each tolerant of legacy drift —
    // a single missing/renamed column must never throw on every request and brick
    // the API.
    foreach (['idx_ci_date' => 'date', 'idx_ci_type' => 'type', 'idx_ci_grid' => 'grid_position'] as $idx => $col) {
        try {
            $db->exec("CREATE INDEX IF NOT EXISTS $idx ON content_items($col)");
        } catch (Throwable $e) {
            error_log("init_schema: skipped index $idx ($col): " . $e->getMessage());
        }
    }
}

// First-run setup: create the first admin, seed a client from any existing data,
// back-fill client_id, and rebuild day_notes if it's still in the old shape.
// Idempotent: a no-op once any team user exists.
function bootstrap_if_needed(PDO $db, array $CONFIG): void
{
    $hasTeam = (bool) $db->query("SELECT 1 FROM team_users LIMIT 1")->fetchColumn();
    if ($hasTeam) {
        return; // already set up
    }
    $adminUser = trim((string) ($CONFIG['admin_username'] ?? 'admin'));
    $adminPass = (string) ($CONFIG['admin_password'] ?? '');
    if ($adminPass === '') {
        // Not configured yet. Don't fail the whole API — login will report this.
        return;
    }

    $now = now_iso();
    try {
        // Serialize concurrent first-requests: take the write lock up front
        // (busy_timeout makes a second writer wait here), then re-check under the
        // lock so only one request actually seeds — the loser becomes a no-op
        // instead of hitting a UNIQUE violation.
        $db->exec('BEGIN IMMEDIATE');
        if ($db->query("SELECT 1 FROM team_users LIMIT 1")->fetchColumn()) {
            $db->exec('COMMIT');
            return;
        }

        // 1. First Apar admin (password one-way hashed).
        $db->prepare(
            "INSERT INTO team_users (id, name, username, password_hash, status, created_at, updated_at)
             VALUES (?,?,?,?, 'active', ?, ?)"
        )->execute([new_id(), 'Apar Admin', $adminUser, password_hash($adminPass, PASSWORD_DEFAULT), $now, $now]);

        // 2. Seed client #1 — adopts all pre-existing calendar data.
        $seedId   = new_id();
        $seedName = (string) ($CONFIG['seed_client_name'] ?? 'Chheda Jewellers');
        $seedUser = (string) ($CONFIG['seed_client_username'] ?? 'chhedas');
        $seedPass = (string) ($CONFIG['seed_client_password'] ?? bin2hex(random_bytes(6)));
        $db->prepare(
            "INSERT INTO clients (id, name, username, password_enc, status, created_at, updated_at)
             VALUES (?,?,?,?, 'active', ?, ?)"
        )->execute([$seedId, $seedName, $seedUser, enc_secret($seedPass), $now, $now]);

        // 3. Back-fill client_id on legacy rows.
        foreach (['content_items', 'categories', 'special_days', 'period_locks', 'team_members', 'app_info'] as $t) {
            $db->prepare("UPDATE $t SET client_id = ? WHERE client_id IS NULL")->execute([$seedId]);
        }

        // 4. day_notes: convert OLD shape (PK date, no client_id) → new shape.
        $dn = $db->query("PRAGMA table_info(day_notes)")->fetchAll(PDO::FETCH_ASSOC);
        $hasClient = false;
        $datePk = false;
        foreach ($dn as $c) {
            if ($c['name'] === 'client_id') $hasClient = true;
            if ($c['name'] === 'date' && (int) $c['pk'] === 1) $datePk = true;
        }
        if ($dn && !$hasClient && $datePk) {
            // Drop any orphaned scratch table left by a previously aborted run so
            // the rename target is free (the orphan is never-committed; no data).
            $db->exec("DROP TABLE IF EXISTS day_notes_old");
            $db->exec("ALTER TABLE day_notes RENAME TO day_notes_old");
            $db->exec(
                "CREATE TABLE day_notes (
                   id TEXT PRIMARY KEY, client_id TEXT NOT NULL, date TEXT NOT NULL, note TEXT NOT NULL,
                   drive_link TEXT, updated_by TEXT, updated_at TEXT NOT NULL
                 )"
            );
            $db->prepare(
                "INSERT INTO day_notes (id, client_id, date, note, drive_link, updated_by, updated_at)
                 SELECT lower(hex(randomblob(12))), ?, date, note, drive_link, updated_by, updated_at
                 FROM day_notes_old"
            )->execute([$seedId]);
            $db->exec("DROP TABLE day_notes_old");
        }
        // Per-client uniqueness for day notes.
        $db->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_day_notes_client_date ON day_notes(client_id, date)");

        $db->exec('COMMIT');
    } catch (Throwable $e) {
        try {
            $db->exec('ROLLBACK');
        } catch (Throwable $ignored) {
            /* no active transaction */
        }
        error_log('First-run setup failed: ' . $e->getMessage());
        fail('Server setup error', 500);
    }
}

function pdo(): PDO
{
    global $DB_FILE, $CONFIG;
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $dir = dirname($DB_FILE);
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    // Keep the database file (and its -wal/-shm) unreachable from the web.
    $ht = $dir . '/.htaccess';
    if (!is_file($ht)) {
        @file_put_contents(
            $ht,
            "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n" .
            "<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n"
        );
    }
    if (!is_dir($dir) || !is_writable($dir)) {
        fail('Data folder is not writable: ' . $dir . ' (chmod it to 755)', 500);
    }
    try {
        $pdo = new PDO('sqlite:' . $DB_FILE, null, null, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $pdo->exec('PRAGMA journal_mode = WAL');
        $pdo->exec('PRAGMA busy_timeout = 5000');
        init_schema($pdo);
        bootstrap_if_needed($pdo, $CONFIG);
    } catch (Throwable $e) {
        error_log('Database error: ' . $e->getMessage());
        fail('Database unavailable', 500);
    }
    return $pdo;
}

// ── CORS ──
if ($ALLOW_ORIGIN !== '') {
    header('Access-Control-Allow-Origin: ' . ($ALLOW_ORIGIN === '*' ? '*' : $ALLOW_ORIGIN));
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: GET, POST, PATCH, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Client-Id');
    header('Access-Control-Max-Age: 86400');
}
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($method === 'OPTIONS') {
    no_content();
}

// ── Route parsing: strip the /api base, split into segments ──
$scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/api/index.php')), '/');
$uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
if ($scriptDir !== '' && strpos($uriPath, $scriptDir) === 0) {
    $uriPath = substr($uriPath, strlen($scriptDir));
}
$seg = array_values(array_filter(explode('/', $uriPath), fn($s) => $s !== ''));
$seg = array_map('rawurldecode', $seg);
if (isset($seg[0]) && $seg[0] === 'api') {
    array_shift($seg);
}
$n = count($seg);
$r0 = $seg[0] ?? '';

// ═══════════════════════ AUTH CONTEXT ═══════════════════════
function bearer_token(): ?string
{
    // Apache/cPanel often strips Authorization; api/.htaccess re-exposes it as
    // REDIRECT_HTTP_AUTHORIZATION (see DEPLOY-CPANEL.md).
    $h = $_SERVER['HTTP_AUTHORIZATION']
        ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION']
        ?? (function_exists('apache_request_headers')
            ? (apache_request_headers()['Authorization'] ?? '') : ''));
    if (is_string($h) && preg_match('/Bearer\s+(\S+)/i', $h, $m)) {
        return $m[1];
    }
    return null;
}

/** Resolve the current session → ['kind','user_id','client_id','name'] or null. */
function current_context(): ?array
{
    global $SESSION_TTL_DAYS;
    $tok = bearer_token();
    if (!$tok) {
        return null;
    }
    $db = pdo();
    $st = $db->prepare("SELECT * FROM sessions WHERE token = ?");
    $st->execute([$tok]);
    $s = $st->fetch();
    if (!$s || strcmp((string) $s['expires_at'], now_iso()) < 0) {
        return null; // missing or expired
    }

    if ($s['user_kind'] === 'client') {
        // Client sessions are bound to one workspace; the X-Client-Id header is ignored.
        $cl = $db->prepare("SELECT name, status FROM clients WHERE id = ?");
        $cl->execute([$s['client_id']]);
        $crow = $cl->fetch();
        if (!$crow || $crow['status'] !== 'active') {
            return null; // workspace disabled/deleted → session invalid
        }
        $clientId = $s['client_id'];
        $name = (string) $crow['name'];
    } else {
        // Team: name from team_users; active workspace from a validated header.
        $tu = $db->prepare("SELECT name, status FROM team_users WHERE id = ?");
        $tu->execute([$s['user_id']]);
        $trow = $tu->fetch();
        if (!$trow || $trow['status'] !== 'active') {
            return null;
        }
        $name = (string) $trow['name'];
        $hdr = (string) ($_SERVER['HTTP_X_CLIENT_ID'] ?? '');
        $clientId = null;
        if ($hdr !== '') {
            $c = $db->prepare("SELECT 1 FROM clients WHERE id = ? AND status = 'active'");
            $c->execute([$hdr]);
            if ($c->fetchColumn()) {
                $clientId = $hdr;
            }
        }
    }

    // Sliding refresh.
    $db->prepare("UPDATE sessions SET expires_at = ?, last_seen = ? WHERE token = ?")
       ->execute([iso_plus_days($SESSION_TTL_DAYS), now_iso(), $tok]);

    return ['kind' => $s['user_kind'], 'user_id' => $s['user_id'], 'client_id' => $clientId, 'name' => $name];
}

function require_auth(): array
{
    $ctx = current_context();
    if (!$ctx) {
        fail('Unauthorized', 401);
    }
    return $ctx;
}
function require_team(array $ctx): void
{
    if ($ctx['kind'] !== 'team') {
        fail('Forbidden — team access required', 403);
    }
}
function require_client_scope(array $ctx): string
{
    if (empty($ctx['client_id'])) {
        fail('No active client workspace (X-Client-Id required)', 400);
    }
    return (string) $ctx['client_id'];
}

$db = pdo();

// ═══════════════════════════ HEALTH ═══════════════════════════ (public)
if ($r0 === 'health') {
    send_json([
        'ok'      => true,
        'time'    => now_iso(),
        'engine'  => 'sqlite',
        'crypto'  => function_exists('openssl_encrypt') ? 'openssl' : 'plaintext',
        'hasAdmin' => (bool) $db->query("SELECT 1 FROM team_users LIMIT 1")->fetchColumn(),
    ]);
}

// ═══════════════════════════ AUTH ═══════════════════════════
if ($r0 === 'auth') {
    if ($method === 'POST' && $n === 2 && $seg[1] === 'login') {
        $b = body_json();
        $username = trim((string) ($b['username'] ?? ''));
        $password = (string) ($b['password'] ?? '');
        // Opportunistic cleanup of expired sessions.
        $db->prepare("DELETE FROM sessions WHERE expires_at < ?")->execute([now_iso()]);

        if ($username === '' || $password === '') {
            fail('Username and password are required', 400);
        }
        $now = now_iso();

        // 1) Team user (hashed password).
        $tu = $db->prepare("SELECT * FROM team_users WHERE username = ? AND status = 'active'");
        $tu->execute([$username]);
        $team = $tu->fetch();
        if ($team && password_verify($password, $team['password_hash'])) {
            $token = new_token();
            $db->prepare(
                "INSERT INTO sessions (token, user_kind, user_id, client_id, created_at, expires_at, last_seen)
                 VALUES (?, 'team', ?, NULL, ?, ?, ?)"
            )->execute([$token, $team['id'], $now, iso_plus_days($GLOBALS['SESSION_TTL_DAYS']), $now]);
            send_json(['token' => $token, 'kind' => 'team', 'name' => $team['name'], 'user_id' => $team['id']]);
        }

        // 2) Client user (reversible password). dec_secret() returns null if the
        // stored value can't be decrypted (lost secret_key) — never authenticate.
        $cl = $db->prepare("SELECT * FROM clients WHERE username = ? AND status = 'active'");
        $cl->execute([$username]);
        $client = $cl->fetch();
        if ($client) {
            $dec = dec_secret($client['password_enc']);
            if ($dec !== null && hash_equals($dec, $password)) {
                $token = new_token();
                $db->prepare(
                    "INSERT INTO sessions (token, user_kind, user_id, client_id, created_at, expires_at, last_seen)
                     VALUES (?, 'client', ?, ?, ?, ?, ?)"
                )->execute([$token, $client['id'], $client['id'], $now, iso_plus_days($GLOBALS['SESSION_TTL_DAYS']), $now]);
                send_json([
                    'token' => $token, 'kind' => 'client', 'name' => $client['name'],
                    'user_id' => $client['id'], 'client_id' => $client['id'],
                ]);
            }
        }

        // Uniform effort + error to avoid username enumeration. The dummy hash is
        // generated at the SAME cost as real hashes, so login timing can't reveal
        // which usernames are real (esp. privileged team) accounts.
        if (!$team) {
            static $dummyHash = null;
            if ($dummyHash === null) {
                $dummyHash = password_hash('invalid-account', PASSWORD_DEFAULT);
            }
            password_verify($password, $dummyHash);
        }
        fail('Invalid username or password', 401);
    }

    $ctx = require_auth();

    if ($method === 'POST' && $n === 2 && $seg[1] === 'logout') {
        $tok = bearer_token();
        if ($tok) {
            $db->prepare("DELETE FROM sessions WHERE token = ?")->execute([$tok]);
        }
        no_content();
    }

    if ($method === 'GET' && $n === 2 && $seg[1] === 'me') {
        if ($ctx['kind'] === 'team') {
            $clients = $db->query(
                "SELECT id, name, username, status, brand_color, text_color, bg_color FROM clients ORDER BY name ASC"
            )->fetchAll();
            send_json([
                'kind'             => 'team',
                'name'             => $ctx['name'],
                'user_id'          => $ctx['user_id'],
                'active_client_id' => $ctx['client_id'],
                'clients'          => $clients,
            ]);
        }
        // Client: just their own workspace.
        $cl = $db->prepare("SELECT id, name, username, status, brand_color, text_color, bg_color FROM clients WHERE id = ?");
        $cl->execute([$ctx['client_id']]);
        $self = $cl->fetch();
        send_json([
            'kind'             => 'client',
            'name'             => $ctx['name'],
            'user_id'          => $ctx['user_id'],
            'active_client_id' => $ctx['client_id'],
            'clients'          => $self ? [$self] : [],
        ]);
    }
    fail('Not found', 404);
}

// ═══════════════════════════ CLIENTS (team only) ═══════════════════════════
if ($r0 === 'clients') {
    $ctx = require_auth();
    require_team($ctx);

    if ($method === 'GET' && $n === 1) {
        $rows = $db->query("SELECT * FROM clients ORDER BY name ASC")->fetchAll();
        send_json(array_map(fn($r) => hydrate_client($r, true), $rows));
    }

    if ($method === 'POST' && $n === 1) {
        $b = body_json();
        $name = trim((string) ($b['name'] ?? ''));
        $username = trim((string) ($b['username'] ?? ''));
        $password = (string) ($b['password'] ?? '');
        if ($name === '' || $username === '' || $password === '') {
            fail('name, username and password are required');
        }
        $dup = $db->prepare("SELECT 1 FROM clients WHERE username = ?");
        $dup->execute([$username]);
        if ($dup->fetchColumn()) {
            fail('That username is already taken', 409);
        }
        $id = new_id();
        $now = now_iso();
        $db->prepare(
            "INSERT INTO clients (id, name, username, password_enc, status, brand_color, text_color, bg_color, created_at, updated_at)
             VALUES (?,?,?,?, 'active', ?, ?, ?, ?, ?)"
        )->execute([
            $id, $name, $username, enc_secret($password),
            clean_hex($b['brand_color'] ?? null), clean_hex($b['text_color'] ?? null), clean_hex($b['bg_color'] ?? null),
            $now, $now,
        ]);
        $st = $db->prepare("SELECT * FROM clients WHERE id = ?");
        $st->execute([$id]);
        send_json(hydrate_client($st->fetch(), true), 201);
    }

    if ($n === 2) {
        $id = $seg[1];
        if ($method === 'GET') {
            $st = $db->prepare("SELECT * FROM clients WHERE id = ?");
            $st->execute([$id]);
            $r = $st->fetch();
            if (!$r) fail('Not found', 404);
            send_json(hydrate_client($r, true));
        }
        if ($method === 'PATCH') {
            $b = body_json();
            $sets = [];
            $vals = [];
            if (array_key_exists('name', $b)) {
                $sets[] = 'name = ?';
                $vals[] = trim((string) $b['name']);
            }
            if (array_key_exists('username', $b)) {
                $u = trim((string) $b['username']);
                $dup = $db->prepare("SELECT 1 FROM clients WHERE username = ? AND id <> ?");
                $dup->execute([$u, $id]);
                if ($dup->fetchColumn()) {
                    fail('That username is already taken', 409);
                }
                $sets[] = 'username = ?';
                $vals[] = $u;
            }
            $pwChanged = false;
            if (array_key_exists('password', $b) && (string) $b['password'] !== '') {
                $sets[] = 'password_enc = ?';
                $vals[] = enc_secret((string) $b['password']);
                $pwChanged = true;
            }
            if (array_key_exists('status', $b)) {
                $status = $b['status'] === 'disabled' ? 'disabled' : 'active';
                $sets[] = 'status = ?';
                $vals[] = $status;
                // Disabling a client kills its live sessions.
                if ($status === 'disabled') {
                    $db->prepare("DELETE FROM sessions WHERE user_kind = 'client' AND client_id = ?")->execute([$id]);
                }
            }
            foreach (['brand_color', 'text_color', 'bg_color'] as $col) {
                if (array_key_exists($col, $b)) {
                    $sets[] = "$col = ?";
                    $vals[] = clean_hex($b[$col]); // null clears it
                }
            }
            if (!$sets) {
                fail('Nothing to update');
            }
            $sets[] = 'updated_at = ?';
            $vals[] = now_iso();
            $vals[] = $id;
            $db->prepare("UPDATE clients SET " . implode(', ', $sets) . " WHERE id = ?")->execute($vals);
            // Rotating a client's password revokes that client's live sessions, so a
            // reset truly cuts off access (the team caller holds a separate session).
            if ($pwChanged) {
                $db->prepare("DELETE FROM sessions WHERE user_kind = 'client' AND client_id = ?")->execute([$id]);
            }
            $st = $db->prepare("SELECT * FROM clients WHERE id = ?");
            $st->execute([$id]);
            $r = $st->fetch();
            if (!$r) fail('Not found', 404);
            send_json(hydrate_client($r, true));
        }
        if ($method === 'DELETE') {
            // Gather media paths BEFORE deleting rows.
            $mrows = $db->prepare("SELECT media FROM content_items WHERE client_id = ?");
            $mrows->execute([$id]);
            $paths = [];
            foreach ($mrows->fetchAll(PDO::FETCH_COLUMN, 0) as $mediaJson) {
                $arr = json_decode((string) $mediaJson, true) ?: [];
                foreach ($arr as $m) {
                    if (is_string($m)) {
                        $paths[] = $m;
                    } elseif (is_array($m) && isset($m['path'])) {
                        $paths[] = $m['path'];
                    }
                }
            }
            $db->beginTransaction();
            foreach (['content_items', 'categories', 'special_days', 'period_locks',
                      'team_members', 'app_info', 'content_comments', 'day_notes', 'day_comments'] as $t) {
                $db->prepare("DELETE FROM $t WHERE client_id = ?")->execute([$id]);
            }
            $db->prepare("DELETE FROM sessions WHERE user_kind = 'client' AND client_id = ?")->execute([$id]);
            $db->prepare("DELETE FROM clients WHERE id = ?")->execute([$id]);
            $db->commit();
            // Disk cleanup AFTER commit (can't roll back unlinks).
            delete_media_files($paths);
            no_content();
        }
    }
    fail('Not found', 404);
}

// ═══════════════════════════ TEAM USERS (team only) ═══════════════════════════
if ($r0 === 'team-users') {
    $ctx = require_auth();
    require_team($ctx);

    if ($method === 'GET' && $n === 1) {
        $rows = $db->query(
            "SELECT id, name, username, status, created_at, updated_at FROM team_users ORDER BY name ASC"
        )->fetchAll();
        send_json($rows);
    }
    if ($method === 'POST' && $n === 1) {
        $b = body_json();
        $name = trim((string) ($b['name'] ?? ''));
        $username = trim((string) ($b['username'] ?? ''));
        $password = (string) ($b['password'] ?? '');
        if ($name === '' || $username === '' || $password === '') {
            fail('name, username and password are required');
        }
        $dup = $db->prepare("SELECT 1 FROM team_users WHERE username = ?");
        $dup->execute([$username]);
        if ($dup->fetchColumn()) {
            fail('That username is already taken', 409);
        }
        $id = new_id();
        $now = now_iso();
        $db->prepare(
            "INSERT INTO team_users (id, name, username, password_hash, status, created_at, updated_at)
             VALUES (?,?,?,?, 'active', ?, ?)"
        )->execute([$id, $name, $username, password_hash($password, PASSWORD_DEFAULT), $now, $now]);
        send_json(['id' => $id, 'name' => $name, 'username' => $username, 'status' => 'active', 'created_at' => $now, 'updated_at' => $now], 201);
    }
    if ($n === 2) {
        $id = $seg[1];
        if ($method === 'PATCH') {
            $b = body_json();
            $sets = [];
            $vals = [];
            if (array_key_exists('name', $b)) {
                $sets[] = 'name = ?';
                $vals[] = trim((string) $b['name']);
            }
            if (array_key_exists('username', $b)) {
                $u = trim((string) $b['username']);
                $dup = $db->prepare("SELECT 1 FROM team_users WHERE username = ? AND id <> ?");
                $dup->execute([$u, $id]);
                if ($dup->fetchColumn()) {
                    fail('That username is already taken', 409);
                }
                $sets[] = 'username = ?';
                $vals[] = $u;
            }
            $teamPwChanged = false;
            if (array_key_exists('password', $b) && (string) $b['password'] !== '') {
                $sets[] = 'password_hash = ?';
                $vals[] = password_hash((string) $b['password'], PASSWORD_DEFAULT);
                $teamPwChanged = true;
            }
            $teamDisabled = false;
            if (array_key_exists('status', $b)) {
                $newStatus = $b['status'] === 'disabled' ? 'disabled' : 'active';
                $sets[] = 'status = ?';
                $vals[] = $newStatus;
                $teamDisabled = $newStatus === 'disabled';
            }
            if (!$sets) {
                fail('Nothing to update');
            }
            $sets[] = 'updated_at = ?';
            $vals[] = now_iso();
            $vals[] = $id;
            $db->prepare("UPDATE team_users SET " . implode(', ', $sets) . " WHERE id = ?")->execute($vals);
            // Disabling kills all of that user's sessions; a password change kills
            // them too but keeps the caller's own token (self-service rotation
            // shouldn't sign you out).
            if ($teamDisabled) {
                $db->prepare("DELETE FROM sessions WHERE user_kind = 'team' AND user_id = ?")->execute([$id]);
            } elseif ($teamPwChanged) {
                $db->prepare("DELETE FROM sessions WHERE user_kind = 'team' AND user_id = ? AND token <> ?")
                   ->execute([$id, bearer_token() ?? '']);
            }
            $st = $db->prepare("SELECT id, name, username, status, created_at, updated_at FROM team_users WHERE id = ?");
            $st->execute([$id]);
            send_json($st->fetch() ?: null);
        }
        if ($method === 'DELETE') {
            // Don't allow deleting the last remaining team account.
            $count = (int) $db->query("SELECT COUNT(*) FROM team_users WHERE status = 'active'")->fetchColumn();
            if ($count <= 1) {
                fail('Cannot remove the last team account', 409);
            }
            $db->prepare("DELETE FROM team_users WHERE id = ?")->execute([$id]);
            $db->prepare("DELETE FROM sessions WHERE user_kind = 'team' AND user_id = ?")->execute([$id]);
            no_content();
        }
    }
    fail('Not found', 404);
}

// ─── Everything below is workspace data: authenticated + client-scoped. ───
$ctx = require_auth();

// ── Content item helpers ──
const CONTENT_COLUMNS = [
    'date', 'day_of_week', 'type', 'post_format', 'media_type', 'media',
    'title', 'caption', 'drive_link', 'category_id', 'status', 'assigned_to',
    'notes', 'grid_position',
];
function hydrate_content(array $r): array
{
    return [
        'id'            => $r['id'],
        'date'          => $r['date'],
        'day_of_week'   => $r['day_of_week'],
        'type'          => $r['type'],
        'post_format'   => $r['post_format'],
        'media_type'    => $r['media_type'],
        'media'         => ($r['media'] !== null && $r['media'] !== '') ? json_decode($r['media'], true) : [],
        'title'         => $r['title'],
        'caption'       => $r['caption'],
        'drive_link'    => $r['drive_link'],
        'category_id'   => $r['category_id'],
        'status'        => $r['status'],
        'assigned_to'   => $r['assigned_to'],
        'notes'         => $r['notes'],
        'grid_position' => $r['grid_position'] === null ? null : (int) $r['grid_position'],
        'approval_state'      => $r['approval_state'] ?? 'pending',
        'approval_updated_at' => $r['approval_updated_at'] ?? null,
        'approval_updated_by' => $r['approval_updated_by'] ?? null,
        'created_at'    => $r['created_at'],
        'updated_at'    => $r['updated_at'],
    ];
}
function encode_content_field(string $key, $value)
{
    if ($key === 'media') {
        return json_encode(is_array($value) ? $value : [], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
    if ($key === 'grid_position') {
        return ($value === null || $value === '') ? null : (int) $value;
    }
    return $value;
}
function content_by_id(string $id, string $clientId): ?array
{
    $st = pdo()->prepare("SELECT * FROM content_items WHERE id = ? AND client_id = ?");
    $st->execute([$id, $clientId]);
    $row = $st->fetch();
    return $row ? hydrate_content($row) : null;
}
function delete_media_files(array $paths): void
{
    global $MEDIA_DIR;
    foreach ($paths as $p) {
        if (is_string($p) && $p !== '') {
            $file = $MEDIA_DIR . '/' . basename($p);
            if (is_file($file)) {
                @unlink($file);
            }
        }
    }
}

// ═══════════════════════════ CONTENT ═══════════════════════════
if ($r0 === 'content') {
    $clientId = require_client_scope($ctx);

    // ── Per-item review (client + team) ──
    if ($n === 3 && $seg[1] !== 'grid' && $seg[2] === 'approval' && $method === 'PUT') {
        $state = (string) (body_json()['state'] ?? '');
        if (!in_array($state, ['pending', 'approved', 'changes_requested'], true)) {
            fail('Invalid approval state');
        }
        $now = now_iso();
        $st = $db->prepare(
            "UPDATE content_items SET approval_state = ?, approval_updated_at = ?, approval_updated_by = ?
             WHERE id = ? AND client_id = ?"
        );
        $st->execute([$state, $now, $ctx['name'], $seg[1], $clientId]);
        if ($st->rowCount() === 0 && !content_by_id($seg[1], $clientId)) {
            fail('Not found', 404);
        }
        send_json(content_by_id($seg[1], $clientId));
    }
    if ($n >= 3 && $seg[1] !== 'grid' && $seg[2] === 'comments') {
        $itemId = $seg[1];
        if (!content_by_id($itemId, $clientId)) {
            fail('Not found', 404);
        }
        if ($method === 'GET' && $n === 3) {
            $st = $db->prepare(
                "SELECT id, content_id, author_kind, author_name, body, created_at
                 FROM content_comments WHERE client_id = ? AND content_id = ? ORDER BY created_at ASC"
            );
            $st->execute([$clientId, $itemId]);
            send_json($st->fetchAll());
        }
        if ($method === 'POST' && $n === 3) {
            $body = trim((string) (body_json()['body'] ?? ''));
            if ($body === '') {
                fail('Comment body is required');
            }
            $id = new_id();
            $now = now_iso();
            $db->prepare(
                "INSERT INTO content_comments (id, client_id, content_id, author_kind, author_id, author_name, body, created_at)
                 VALUES (?,?,?,?,?,?,?,?)"
            )->execute([$id, $clientId, $itemId, $ctx['kind'], $ctx['user_id'], $ctx['name'], $body, $now]);
            send_json([
                'id' => $id, 'content_id' => $itemId, 'author_kind' => $ctx['kind'],
                'author_name' => $ctx['name'], 'body' => $body, 'created_at' => $now,
            ], 201);
        }
        if ($method === 'DELETE' && $n === 4) {
            require_team($ctx); // only the team can remove comments
            $db->prepare("DELETE FROM content_comments WHERE id = ? AND client_id = ? AND content_id = ?")
               ->execute([$seg[3], $clientId, $itemId]);
            no_content();
        }
        fail('Not found', 404);
    }

    // ── Read (client + team) ──
    if ($method === 'GET' && $n === 2 && $seg[1] === 'grid') {
        $st = $db->prepare(
            "SELECT * FROM content_items WHERE client_id = ? AND type IN ('post','reel')
             ORDER BY (grid_position IS NULL) ASC, grid_position ASC, date ASC"
        );
        $st->execute([$clientId]);
        send_json(array_map('hydrate_content', $st->fetchAll()));
    }
    if ($method === 'GET' && $n === 1) {
        if (isset($_GET['date'])) {
            $st = $db->prepare(
                "SELECT * FROM content_items WHERE client_id = ? AND date = ?
                 ORDER BY date ASC, (grid_position IS NULL) ASC, grid_position ASC, created_at ASC"
            );
            $st->execute([$clientId, $_GET['date']]);
        } elseif (isset($_GET['start'], $_GET['end'])) {
            $st = $db->prepare(
                "SELECT * FROM content_items WHERE client_id = ? AND date >= ? AND date <= ?
                 ORDER BY date ASC, (grid_position IS NULL) ASC, grid_position ASC, created_at ASC"
            );
            $st->execute([$clientId, $_GET['start'], $_GET['end']]);
        } else {
            $st = $db->prepare(
                "SELECT * FROM content_items WHERE client_id = ?
                 ORDER BY date ASC, (grid_position IS NULL) ASC, grid_position ASC, created_at ASC"
            );
            $st->execute([$clientId]);
        }
        send_json(array_map('hydrate_content', $st->fetchAll()));
    }

    // ── Write (team only) ──
    if ($method === 'POST' && $n === 3 && $seg[1] === 'grid' && $seg[2] === 'reorder') {
        require_team($ctx);
        $ids = body_json()['orderedIds'] ?? [];
        if (!is_array($ids)) {
            $ids = [];
        }
        $db->beginTransaction();
        $st = $db->prepare("UPDATE content_items SET grid_position = ?, updated_at = ? WHERE id = ? AND client_id = ?");
        $now = now_iso();
        $i = 1;
        foreach ($ids as $id) {
            $st->execute([$i++, $now, $id, $clientId]);
        }
        $db->commit();
        no_content();
    }
    if ($method === 'POST' && $n === 1) {
        require_team($ctx);
        $b = body_json();
        if (empty($b['date']) || empty($b['type'])) {
            fail('date and type are required');
        }
        $id = new_id();
        $now = now_iso();
        $cols = ['id', 'client_id'];
        $ph = ['?', '?'];
        $vals = [$id, $clientId];
        foreach (CONTENT_COLUMNS as $c) {
            $cols[] = "`$c`";
            $ph[] = '?';
            $present = array_key_exists($c, $b);
            $default = $c === 'status' ? 'scheduled' : ($c === 'media' ? [] : null);
            $vals[] = encode_content_field($c, $present ? $b[$c] : $default);
        }
        $cols[] = 'created_at';
        $ph[] = '?';
        $vals[] = $now;
        $cols[] = 'updated_at';
        $ph[] = '?';
        $vals[] = $now;
        $db->prepare("INSERT INTO content_items (" . implode(',', $cols) . ") VALUES (" . implode(',', $ph) . ")")
           ->execute($vals);
        send_json(content_by_id($id, $clientId), 201);
    }
    if ($n === 2 && $seg[1] !== 'grid') {
        $id = $seg[1];
        if ($method === 'PATCH') {
            require_team($ctx);
            $b = body_json();
            $sets = [];
            $vals = [];
            foreach (CONTENT_COLUMNS as $c) {
                if (array_key_exists($c, $b)) {
                    $sets[] = "`$c` = ?";
                    $vals[] = encode_content_field($c, $b[$c]);
                }
            }
            $sets[] = 'updated_at = ?';
            $vals[] = now_iso();
            $vals[] = $id;
            $vals[] = $clientId;
            $db->prepare("UPDATE content_items SET " . implode(', ', $sets) . " WHERE id = ? AND client_id = ?")->execute($vals);
            $row = content_by_id($id, $clientId);
            if (!$row) fail('Not found', 404);
            send_json($row);
        }
        if ($method === 'DELETE') {
            require_team($ctx);
            // Derive the files to unlink from the row's OWN media (scoped to this
            // client) — never from caller-supplied paths, which could name another
            // workspace's files.
            $mrow = $db->prepare("SELECT media FROM content_items WHERE id = ? AND client_id = ?");
            $mrow->execute([$id, $clientId]);
            $mediaJson = $mrow->fetchColumn();
            $paths = [];
            if ($mediaJson) {
                foreach (json_decode((string) $mediaJson, true) ?: [] as $m) {
                    if (is_string($m)) {
                        $paths[] = $m;
                    } elseif (is_array($m) && isset($m['path'])) {
                        $paths[] = $m['path'];
                    }
                }
            }
            $db->prepare("DELETE FROM content_items WHERE id = ? AND client_id = ?")->execute([$id, $clientId]);
            $db->prepare("DELETE FROM content_comments WHERE content_id = ? AND client_id = ?")->execute([$id, $clientId]);
            delete_media_files($paths);
            no_content();
        }
    }
    fail('Not found', 404);
}

// ═══════════════════════════ DAY NOTES ═══════════════════════════
if ($r0 === 'day-notes' && $n === 2) {
    $clientId = require_client_scope($ctx);
    $date = $seg[1];
    if ($method === 'GET') {
        $st = $db->prepare("SELECT * FROM day_notes WHERE client_id = ? AND date = ?");
        $st->execute([$clientId, $date]);
        $row = $st->fetch();
        send_json($row ? [
            'date' => $row['date'], 'note' => $row['note'],
            'drive_link' => $row['drive_link'] ?? null,
            'updated_by' => $row['updated_by'], 'updated_at' => $row['updated_at'],
        ] : null);
    }
    if ($method === 'PUT') {
        require_team($ctx);
        $b = body_json();
        $note = (string) ($b['note'] ?? '');
        $drive = array_key_exists('drive_link', $b) ? ($b['drive_link'] ?: null) : null;
        $now = now_iso();
        $ex = $db->prepare("SELECT id FROM day_notes WHERE client_id = ? AND date = ?");
        $ex->execute([$clientId, $date]);
        $existing = $ex->fetchColumn();
        if ($existing) {
            $db->prepare("UPDATE day_notes SET note = ?, drive_link = ?, updated_at = ? WHERE id = ?")
               ->execute([$note, $drive, $now, $existing]);
        } else {
            $db->prepare("INSERT INTO day_notes (id, client_id, date, note, drive_link, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, NULL, ?)")
               ->execute([new_id(), $clientId, $date, $note, $drive, $now]);
        }
        send_json(['date' => $date, 'note' => $note, 'drive_link' => $drive, 'updated_by' => null, 'updated_at' => $now]);
    }
    fail('Method not allowed', 405);
}

// ═══════════════════════ DAY COMMENTS (client notes + team replies/ack) ═══════════════════════
if ($r0 === 'day-comments') {
    $clientId = require_client_scope($ctx);
    // GET /day-comments/:date — the thread for one day (client + team).
    if ($method === 'GET' && $n === 2) {
        $st = $db->prepare(
            "SELECT id, date, author_kind, author_name, body, acknowledged, acknowledged_by, created_at
             FROM day_comments WHERE client_id = ? AND date = ? ORDER BY created_at ASC"
        );
        $st->execute([$clientId, $seg[1]]);
        send_json(array_map(fn($r) => [
            'id'             => $r['id'],
            'date'           => $r['date'],
            'author_kind'    => $r['author_kind'],
            'author_name'    => $r['author_name'],
            'body'           => $r['body'],
            'acknowledged'   => (bool) (int) $r['acknowledged'],
            'acknowledged_by' => $r['acknowledged_by'],
            'created_at'     => $r['created_at'],
        ], $st->fetchAll()));
    }
    // POST /day-comments/:date — add a note (client) or a reply (team).
    if ($method === 'POST' && $n === 2) {
        $body = trim((string) (body_json()['body'] ?? ''));
        if ($body === '') {
            fail('Note cannot be empty');
        }
        $id = new_id();
        $now = now_iso();
        $db->prepare(
            "INSERT INTO day_comments (id, client_id, date, author_kind, author_id, author_name, body, acknowledged, created_at)
             VALUES (?,?,?,?,?,?,?,0,?)"
        )->execute([$id, $clientId, $seg[1], $ctx['kind'], $ctx['user_id'], $ctx['name'], $body, $now]);
        send_json([
            'id' => $id, 'date' => $seg[1], 'author_kind' => $ctx['kind'], 'author_name' => $ctx['name'],
            'body' => $body, 'acknowledged' => false, 'acknowledged_by' => null, 'created_at' => $now,
        ], 201);
    }
    // PATCH /day-comments/:id — team toggles "acknowledged" on a note.
    if ($method === 'PATCH' && $n === 2) {
        require_team($ctx);
        $ack = (bool) (body_json()['acknowledged'] ?? true);
        $st = $db->prepare("UPDATE day_comments SET acknowledged = ?, acknowledged_by = ? WHERE id = ? AND client_id = ?");
        $st->execute([$ack ? 1 : 0, $ack ? $ctx['name'] : null, $seg[1], $clientId]);
        if ($st->rowCount() === 0) {
            fail('Not found', 404);
        }
        no_content();
    }
    // DELETE /day-comments/:id — team only.
    if ($method === 'DELETE' && $n === 2) {
        require_team($ctx);
        $db->prepare("DELETE FROM day_comments WHERE id = ? AND client_id = ?")->execute([$seg[1], $clientId]);
        no_content();
    }
    fail('Not found', 404);
}

// ═══════════════════════════ CATEGORIES ═══════════════════════════
if ($r0 === 'categories') {
    $clientId = require_client_scope($ctx);
    if ($method === 'GET' && $n === 1) {
        $st = $db->prepare("SELECT * FROM categories WHERE client_id = ? ORDER BY name ASC");
        $st->execute([$clientId]);
        send_json($st->fetchAll());
    }
    if ($method === 'POST' && $n === 1) {
        require_team($ctx);
        $b = body_json();
        $id = new_id();
        $now = now_iso();
        $name = (string) ($b['name'] ?? '');
        $color = (string) ($b['color'] ?? '#888888');
        $db->prepare("INSERT INTO categories (id, client_id, name, color, created_at) VALUES (?,?,?,?,?)")
           ->execute([$id, $clientId, $name, $color, $now]);
        send_json(['id' => $id, 'name' => $name, 'color' => $color, 'created_at' => $now], 201);
    }
    if ($n === 2) {
        $id = $seg[1];
        if ($method === 'PATCH') {
            require_team($ctx);
            $b = body_json();
            $sets = [];
            $vals = [];
            foreach (['name', 'color'] as $c) {
                if (array_key_exists($c, $b)) {
                    $sets[] = "`$c` = ?";
                    $vals[] = $b[$c];
                }
            }
            if ($sets) {
                $vals[] = $id;
                $vals[] = $clientId;
                $db->prepare("UPDATE categories SET " . implode(', ', $sets) . " WHERE id = ? AND client_id = ?")->execute($vals);
            }
            $st = $db->prepare("SELECT * FROM categories WHERE id = ? AND client_id = ?");
            $st->execute([$id, $clientId]);
            send_json($st->fetch() ?: null);
        }
        if ($method === 'DELETE') {
            require_team($ctx);
            $db->prepare("DELETE FROM categories WHERE id = ? AND client_id = ?")->execute([$id, $clientId]);
            no_content();
        }
    }
    fail('Not found', 404);
}

// ═══════════════════════════ TEAM MEMBERS (assignees) ═══════════════════════════
if ($r0 === 'team-members') {
    $clientId = require_client_scope($ctx);
    if ($method === 'GET' && $n === 1) {
        $st = $db->prepare("SELECT * FROM team_members WHERE client_id = ? ORDER BY name ASC");
        $st->execute([$clientId]);
        send_json($st->fetchAll());
    }
    if ($method === 'POST' && $n === 1) {
        require_team($ctx);
        $id = new_id();
        $now = now_iso();
        $name = (string) (body_json()['name'] ?? '');
        $db->prepare("INSERT INTO team_members (id, client_id, name, created_at) VALUES (?,?,?,?)")
           ->execute([$id, $clientId, $name, $now]);
        send_json(['id' => $id, 'name' => $name, 'created_at' => $now], 201);
    }
    if ($n === 2) {
        $id = $seg[1];
        if ($method === 'PATCH') {
            require_team($ctx);
            $name = (string) (body_json()['name'] ?? '');
            $db->prepare("UPDATE team_members SET name = ? WHERE id = ? AND client_id = ?")->execute([$name, $id, $clientId]);
            $st = $db->prepare("SELECT * FROM team_members WHERE id = ? AND client_id = ?");
            $st->execute([$id, $clientId]);
            send_json($st->fetch() ?: null);
        }
        if ($method === 'DELETE') {
            require_team($ctx);
            $db->prepare("DELETE FROM team_members WHERE id = ? AND client_id = ?")->execute([$id, $clientId]);
            no_content();
        }
    }
    fail('Not found', 404);
}

// ═══════════════════════════ APP INFO ═══════════════════════════
if ($r0 === 'app-info' && $n === 1) {
    $clientId = require_client_scope($ctx);
    if ($method === 'GET') {
        $st = $db->prepare("SELECT * FROM app_info WHERE client_id = ?");
        $st->execute([$clientId]);
        $row = $st->fetch();
        send_json($row ? ['id' => $row['id'], 'content' => $row['content'], 'updated_at' => $row['updated_at']] : null);
    }
    if ($method === 'PUT') {
        require_team($ctx);
        $content = (string) (body_json()['content'] ?? '');
        $now = now_iso();
        $ex = $db->prepare("SELECT id FROM app_info WHERE client_id = ?");
        $ex->execute([$clientId]);
        $existing = $ex->fetchColumn();
        if ($existing) {
            $db->prepare("UPDATE app_info SET content = ?, updated_at = ? WHERE id = ?")->execute([$content, $now, $existing]);
            $id = $existing;
        } else {
            $id = new_id();
            $db->prepare("INSERT INTO app_info (id, client_id, content, updated_at) VALUES (?, ?, ?, ?)")->execute([$id, $clientId, $content, $now]);
        }
        send_json(['id' => $id, 'content' => $content, 'updated_at' => $now]);
    }
    fail('Method not allowed', 405);
}

// ═══════════════════════════ SPECIAL DAYS ═══════════════════════════
if ($r0 === 'special-days') {
    $clientId = require_client_scope($ctx);
    if ($method === 'GET' && $n === 1) {
        if (isset($_GET['start'], $_GET['end'])) {
            $st = $db->prepare("SELECT * FROM special_days WHERE client_id = ? AND date >= ? AND date <= ? ORDER BY date ASC, created_at ASC");
            $st->execute([$clientId, $_GET['start'], $_GET['end']]);
        } else {
            $st = $db->prepare("SELECT * FROM special_days WHERE client_id = ? ORDER BY date ASC, created_at ASC");
            $st->execute([$clientId]);
        }
        send_json($st->fetchAll());
    }
    if ($method === 'POST' && $n === 1) {
        require_team($ctx);
        $b = body_json();
        $id = new_id();
        $now = now_iso();
        $date = $b['date'] ?? null;
        $label = (string) ($b['label'] ?? '');
        $color = (string) ($b['color'] ?? '#FBDDD4');
        $db->prepare("INSERT INTO special_days (id, client_id, date, label, color, created_at) VALUES (?,?,?,?,?,?)")
           ->execute([$id, $clientId, $date, $label, $color, $now]);
        send_json(['id' => $id, 'date' => $date, 'label' => $label, 'color' => $color, 'created_at' => $now], 201);
    }
    if ($method === 'DELETE' && $n === 2) {
        require_team($ctx);
        $db->prepare("DELETE FROM special_days WHERE id = ? AND client_id = ?")->execute([$seg[1], $clientId]);
        no_content();
    }
    fail('Not found', 404);
}

// ═══════════════════════════ PERIOD LOCKS ═══════════════════════════
if ($r0 === 'locks') {
    $clientId = require_client_scope($ctx);
    if ($method === 'GET' && $n === 1) {
        if (isset($_GET['start'], $_GET['end'])) {
            $st = $db->prepare("SELECT * FROM period_locks WHERE client_id = ? AND start_date <= ? AND end_date >= ? ORDER BY start_date ASC");
            $st->execute([$clientId, $_GET['end'], $_GET['start']]);
        } else {
            $st = $db->prepare("SELECT * FROM period_locks WHERE client_id = ? ORDER BY start_date ASC");
            $st->execute([$clientId]);
        }
        send_json($st->fetchAll());
    }
    if ($method === 'POST' && $n === 1) {
        require_team($ctx);
        $b = body_json();
        $id = new_id();
        $now = now_iso();
        $row = [
            'id'           => $id,
            'client_id'    => $clientId,
            'scope'        => $b['scope'] ?? 'range',
            'start_date'   => $b['start_date'] ?? null,
            'end_date'     => $b['end_date'] ?? null,
            'finalized_by' => $b['finalized_by'] ?? null,
            'finalized_at' => $now,
            'note'         => $b['note'] ?? null,
        ];
        $db->prepare(
            "INSERT INTO period_locks (id, client_id, scope, start_date, end_date, finalized_by, finalized_at, note)
             VALUES (?,?,?,?,?,?,?,?)"
        )->execute(array_values($row));
        unset($row['client_id']);
        send_json($row, 201);
    }
    if ($method === 'DELETE' && $n === 2) {
        require_team($ctx);
        $db->prepare("DELETE FROM period_locks WHERE id = ? AND client_id = ?")->execute([$seg[1], $clientId]);
        no_content();
    }
    fail('Not found', 404);
}

// ═══════════════════════════ MEDIA ═══════════════════════════
// Files live on disk and are served by Apache at /media/<file>. Uploads/deletes
// are team-only (clients are review-only).
if ($r0 === 'media') {
    $clientId = require_client_scope($ctx); // must be operating inside a workspace
    require_team($ctx);
    if ($method === 'POST' && $n === 1) {
        if (empty($_FILES['file'])) {
            fail('No file uploaded');
        }
        $f = $_FILES['file'];
        if ($f['error'] !== UPLOAD_ERR_OK) {
            if (in_array($f['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
                fail('File is larger than the server upload limit. Raise upload_max_filesize / post_max_size (see DEPLOY-CPANEL.md).', 413);
            }
            fail('Upload failed (error ' . $f['error'] . ')');
        }
        if (!is_dir($MEDIA_DIR) && !@mkdir($MEDIA_DIR, 0755, true) && !is_dir($MEDIA_DIR)) {
            fail('Could not create media folder on the server', 500);
        }
        if (!is_writable($MEDIA_DIR)) {
            fail('Media folder is not writable. chmod it to 755 (see DEPLOY-CPANEL.md).', 500);
        }
        $ext = strtolower((string) pathinfo($f['name'], PATHINFO_EXTENSION));
        $ext = preg_replace('/[^a-z0-9]/', '', $ext) ?: 'bin';
        $filename = bin2hex(random_bytes(8)) . '.' . $ext;
        if (!move_uploaded_file($f['tmp_name'], $MEDIA_DIR . '/' . $filename)) {
            fail('Could not save the uploaded file', 500);
        }
        send_json([
            'url'  => $MEDIA_URL . '/' . $filename,
            'path' => $filename,
            'name' => $f['name'],
        ], 201);
    }
    if ($method === 'DELETE' && $n === 2) {
        $name = basename($seg[1]);
        $like = '%' . $name . '%';
        // Delete only files that belong to THIS workspace, or that no workspace
        // references yet (a fresh upload removed before saving). Never another
        // client's referenced media — even though filenames are random.
        $mine = $db->prepare("SELECT 1 FROM content_items WHERE client_id = ? AND media LIKE ? LIMIT 1");
        $mine->execute([$clientId, $like]);
        $byMe = (bool) $mine->fetchColumn();
        $any = $db->prepare("SELECT 1 FROM content_items WHERE media LIKE ? LIMIT 1");
        $any->execute([$like]);
        $byAnyone = (bool) $any->fetchColumn();
        if ($byMe || !$byAnyone) {
            $file = $MEDIA_DIR . '/' . $name;
            if (is_file($file)) {
                @unlink($file);
            }
        }
        no_content();
    }
    fail('Not found', 404);
}

fail('Not found', 404);

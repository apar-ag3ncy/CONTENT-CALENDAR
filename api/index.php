<?php
// -----------------------------------------------------------------------------
// Content-calendar API — PHP + SQLite, for cPanel hosting.
// Single front controller: api/.htaccess routes every /api/* request here.
//
// SQLite means NO database server, user, or password — the data lives in a file
// (api/data/calendar.sqlite) on your cPanel disk. The file + tables are created
// automatically on first run, so there is nothing to configure.
//
// Photos/videos are stored as files on disk (default public_html-side media/)
// and served directly by Apache at /media/<file>.
// -----------------------------------------------------------------------------
declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '0');

// ── Config (optional — only media + CORS settings are read; sane defaults) ──
$CONFIG = is_file(__DIR__ . '/config.php') ? require __DIR__ . '/config.php' : [];
if (!is_array($CONFIG)) {
    $CONFIG = [];
}
$MEDIA_DIR   = rtrim((string) ($CONFIG['media_dir'] ?? (__DIR__ . '/../media')), '/');
$MEDIA_URL   = rtrim((string) ($CONFIG['media_url'] ?? '/media'), '/');
$ALLOW_ORIGIN = (string) ($CONFIG['allow_origin'] ?? '*');
// Where the SQLite database file lives (kept out of the web root's reach by the
// data/.htaccess written below).
$DB_FILE = (string) ($CONFIG['db_file'] ?? (__DIR__ . '/data/calendar.sqlite'));

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
function now_iso(): string
{
    $t = microtime(true);
    $ms = (int) floor(($t - floor($t)) * 1000);
    return gmdate('Y-m-d\TH:i:s', (int) $t) . sprintf('.%03dZ', $ms);
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
CREATE INDEX IF NOT EXISTS idx_ci_date ON content_items(date);
CREATE INDEX IF NOT EXISTS idx_ci_type ON content_items(type);
CREATE INDEX IF NOT EXISTS idx_ci_grid ON content_items(grid_position);

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
CREATE TABLE IF NOT EXISTS day_notes (
  date TEXT PRIMARY KEY, note TEXT NOT NULL, drive_link TEXT, updated_by TEXT, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS app_info (
  id TEXT PRIMARY KEY, content TEXT NOT NULL, updated_at TEXT NOT NULL
);
SQL);
    // Migration: add day_notes.drive_link to databases created before it existed.
    $cols = $db->query("PRAGMA table_info(day_notes)")->fetchAll(PDO::FETCH_COLUMN, 1);
    if (!in_array('drive_link', $cols, true)) {
        $db->exec("ALTER TABLE day_notes ADD COLUMN drive_link TEXT");
    }
}

function pdo(): PDO
{
    global $DB_FILE;
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
    } catch (Throwable $e) {
        fail('Database error: ' . $e->getMessage(), 500);
    }
    return $pdo;
}

// ── CORS ──
if ($ALLOW_ORIGIN !== '') {
    header('Access-Control-Allow-Origin: ' . ($ALLOW_ORIGIN === '*' ? '*' : $ALLOW_ORIGIN));
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: GET, POST, PATCH, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
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
function content_by_id(string $id): ?array
{
    $st = pdo()->prepare("SELECT * FROM content_items WHERE id = ?");
    $st->execute([$id]);
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

$db = pdo();

// ═══════════════════════════ HEALTH ═══════════════════════════
if ($r0 === 'health') {
    send_json(['ok' => true, 'time' => now_iso(), 'engine' => 'sqlite']);
}

// ═══════════════════════════ CONTENT ═══════════════════════════
if ($r0 === 'content') {
    if ($method === 'GET' && $n === 2 && $seg[1] === 'grid') {
        $rows = $db->query(
            "SELECT * FROM content_items WHERE type IN ('post','reel')
             ORDER BY (grid_position IS NULL) ASC, grid_position ASC, date ASC"
        )->fetchAll();
        send_json(array_map('hydrate_content', $rows));
    }
    if ($method === 'POST' && $n === 3 && $seg[1] === 'grid' && $seg[2] === 'reorder') {
        $ids = body_json()['orderedIds'] ?? [];
        if (!is_array($ids)) {
            $ids = [];
        }
        $db->beginTransaction();
        $st = $db->prepare("UPDATE content_items SET grid_position = ?, updated_at = ? WHERE id = ?");
        $now = now_iso();
        $i = 1;
        foreach ($ids as $id) {
            $st->execute([$i++, $now, $id]);
        }
        $db->commit();
        no_content();
    }
    if ($method === 'GET' && $n === 1) {
        if (isset($_GET['date'])) {
            $st = $db->prepare(
                "SELECT * FROM content_items WHERE date = ?
                 ORDER BY date ASC, (grid_position IS NULL) ASC, grid_position ASC, created_at ASC"
            );
            $st->execute([$_GET['date']]);
        } elseif (isset($_GET['start'], $_GET['end'])) {
            $st = $db->prepare(
                "SELECT * FROM content_items WHERE date >= ? AND date <= ?
                 ORDER BY date ASC, (grid_position IS NULL) ASC, grid_position ASC, created_at ASC"
            );
            $st->execute([$_GET['start'], $_GET['end']]);
        } else {
            $st = $db->query(
                "SELECT * FROM content_items
                 ORDER BY date ASC, (grid_position IS NULL) ASC, grid_position ASC, created_at ASC"
            );
        }
        send_json(array_map('hydrate_content', $st->fetchAll()));
    }
    if ($method === 'POST' && $n === 1) {
        $b = body_json();
        if (empty($b['date']) || empty($b['type'])) {
            fail('date and type are required');
        }
        $id = new_id();
        $now = now_iso();
        $cols = ['id'];
        $ph = ['?'];
        $vals = [$id];
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
        send_json(content_by_id($id), 201);
    }
    if ($n === 2 && $seg[1] !== 'grid') {
        $id = $seg[1];
        if ($method === 'PATCH') {
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
            $db->prepare("UPDATE content_items SET " . implode(', ', $sets) . " WHERE id = ?")->execute($vals);
            send_json(content_by_id($id));
        }
        if ($method === 'DELETE') {
            $db->prepare("DELETE FROM content_items WHERE id = ?")->execute([$id]);
            $paths = [];
            if (isset($_GET['media'])) {
                $paths = array_merge($paths, (array) $_GET['media']);
            }
            $bodyPaths = body_json()['mediaPaths'] ?? [];
            if (is_array($bodyPaths)) {
                $paths = array_merge($paths, $bodyPaths);
            }
            delete_media_files($paths);
            no_content();
        }
    }
    fail('Not found', 404);
}

// ═══════════════════════════ DAY NOTES ═══════════════════════════
if ($r0 === 'day-notes' && $n === 2) {
    $date = $seg[1];
    if ($method === 'GET') {
        $st = $db->prepare("SELECT * FROM day_notes WHERE date = ?");
        $st->execute([$date]);
        $row = $st->fetch();
        send_json($row ? [
            'date' => $row['date'], 'note' => $row['note'],
            'drive_link' => $row['drive_link'] ?? null,
            'updated_by' => $row['updated_by'], 'updated_at' => $row['updated_at'],
        ] : null);
    }
    if ($method === 'PUT') {
        $b = body_json();
        $note = (string) ($b['note'] ?? '');
        $drive = array_key_exists('drive_link', $b) ? ($b['drive_link'] ?: null) : null;
        $now = now_iso();
        $ex = $db->prepare("SELECT 1 FROM day_notes WHERE date = ?");
        $ex->execute([$date]);
        if ($ex->fetchColumn()) {
            $db->prepare("UPDATE day_notes SET note = ?, drive_link = ?, updated_at = ? WHERE date = ?")
               ->execute([$note, $drive, $now, $date]);
        } else {
            $db->prepare("INSERT INTO day_notes (date, note, drive_link, updated_by, updated_at) VALUES (?, ?, ?, NULL, ?)")
               ->execute([$date, $note, $drive, $now]);
        }
        send_json(['date' => $date, 'note' => $note, 'drive_link' => $drive, 'updated_by' => null, 'updated_at' => $now]);
    }
    fail('Method not allowed', 405);
}

// ═══════════════════════════ CATEGORIES ═══════════════════════════
if ($r0 === 'categories') {
    if ($method === 'GET' && $n === 1) {
        send_json($db->query("SELECT * FROM categories ORDER BY name ASC")->fetchAll());
    }
    if ($method === 'POST' && $n === 1) {
        $b = body_json();
        $id = new_id();
        $now = now_iso();
        $name = (string) ($b['name'] ?? '');
        $color = (string) ($b['color'] ?? '#888888');
        $db->prepare("INSERT INTO categories (id, name, color, created_at) VALUES (?,?,?,?)")
           ->execute([$id, $name, $color, $now]);
        send_json(['id' => $id, 'name' => $name, 'color' => $color, 'created_at' => $now], 201);
    }
    if ($n === 2) {
        $id = $seg[1];
        if ($method === 'PATCH') {
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
                $db->prepare("UPDATE categories SET " . implode(', ', $sets) . " WHERE id = ?")->execute($vals);
            }
            $st = $db->prepare("SELECT * FROM categories WHERE id = ?");
            $st->execute([$id]);
            send_json($st->fetch() ?: null);
        }
        if ($method === 'DELETE') {
            $db->prepare("DELETE FROM categories WHERE id = ?")->execute([$id]);
            no_content();
        }
    }
    fail('Not found', 404);
}

// ═══════════════════════════ TEAM MEMBERS ═══════════════════════════
if ($r0 === 'team-members') {
    if ($method === 'GET' && $n === 1) {
        send_json($db->query("SELECT * FROM team_members ORDER BY name ASC")->fetchAll());
    }
    if ($method === 'POST' && $n === 1) {
        $id = new_id();
        $now = now_iso();
        $name = (string) (body_json()['name'] ?? '');
        $db->prepare("INSERT INTO team_members (id, name, created_at) VALUES (?,?,?)")
           ->execute([$id, $name, $now]);
        send_json(['id' => $id, 'name' => $name, 'created_at' => $now], 201);
    }
    if ($n === 2) {
        $id = $seg[1];
        if ($method === 'PATCH') {
            $name = (string) (body_json()['name'] ?? '');
            $db->prepare("UPDATE team_members SET name = ? WHERE id = ?")->execute([$name, $id]);
            $st = $db->prepare("SELECT * FROM team_members WHERE id = ?");
            $st->execute([$id]);
            send_json($st->fetch() ?: null);
        }
        if ($method === 'DELETE') {
            $db->prepare("DELETE FROM team_members WHERE id = ?")->execute([$id]);
            no_content();
        }
    }
    fail('Not found', 404);
}

// ═══════════════════════════ APP INFO ═══════════════════════════
if ($r0 === 'app-info' && $n === 1) {
    if ($method === 'GET') {
        $row = $db->query("SELECT * FROM app_info WHERE id = 'main'")->fetch();
        send_json($row ? ['id' => 'main', 'content' => $row['content'], 'updated_at' => $row['updated_at']] : null);
    }
    if ($method === 'PUT') {
        $content = (string) (body_json()['content'] ?? '');
        $now = now_iso();
        $ex = $db->query("SELECT 1 FROM app_info WHERE id = 'main'")->fetchColumn();
        if ($ex) {
            $db->prepare("UPDATE app_info SET content = ?, updated_at = ? WHERE id = 'main'")->execute([$content, $now]);
        } else {
            $db->prepare("INSERT INTO app_info (id, content, updated_at) VALUES ('main', ?, ?)")->execute([$content, $now]);
        }
        send_json(['id' => 'main', 'content' => $content, 'updated_at' => $now]);
    }
    fail('Method not allowed', 405);
}

// ═══════════════════════════ SPECIAL DAYS ═══════════════════════════
if ($r0 === 'special-days') {
    if ($method === 'GET' && $n === 1) {
        if (isset($_GET['start'], $_GET['end'])) {
            $st = $db->prepare("SELECT * FROM special_days WHERE date >= ? AND date <= ? ORDER BY date ASC, created_at ASC");
            $st->execute([$_GET['start'], $_GET['end']]);
        } else {
            $st = $db->query("SELECT * FROM special_days ORDER BY date ASC, created_at ASC");
        }
        send_json($st->fetchAll());
    }
    if ($method === 'POST' && $n === 1) {
        $b = body_json();
        $id = new_id();
        $now = now_iso();
        $date = $b['date'] ?? null;
        $label = (string) ($b['label'] ?? '');
        $color = (string) ($b['color'] ?? '#FBDDD4');
        $db->prepare("INSERT INTO special_days (id, date, label, color, created_at) VALUES (?,?,?,?,?)")
           ->execute([$id, $date, $label, $color, $now]);
        send_json(['id' => $id, 'date' => $date, 'label' => $label, 'color' => $color, 'created_at' => $now], 201);
    }
    if ($method === 'DELETE' && $n === 2) {
        $db->prepare("DELETE FROM special_days WHERE id = ?")->execute([$seg[1]]);
        no_content();
    }
    fail('Not found', 404);
}

// ═══════════════════════════ PERIOD LOCKS ═══════════════════════════
if ($r0 === 'locks') {
    if ($method === 'GET' && $n === 1) {
        if (isset($_GET['start'], $_GET['end'])) {
            $st = $db->prepare("SELECT * FROM period_locks WHERE start_date <= ? AND end_date >= ? ORDER BY start_date ASC");
            $st->execute([$_GET['end'], $_GET['start']]);
        } else {
            $st = $db->query("SELECT * FROM period_locks ORDER BY start_date ASC");
        }
        send_json($st->fetchAll());
    }
    if ($method === 'POST' && $n === 1) {
        $b = body_json();
        $id = new_id();
        $now = now_iso();
        $row = [
            'id'           => $id,
            'scope'        => $b['scope'] ?? 'range',
            'start_date'   => $b['start_date'] ?? null,
            'end_date'     => $b['end_date'] ?? null,
            'finalized_by' => $b['finalized_by'] ?? null,
            'finalized_at' => $now,
            'note'         => $b['note'] ?? null,
        ];
        $db->prepare(
            "INSERT INTO period_locks (id, scope, start_date, end_date, finalized_by, finalized_at, note)
             VALUES (?,?,?,?,?,?,?)"
        )->execute(array_values($row));
        send_json($row, 201);
    }
    if ($method === 'DELETE' && $n === 2) {
        $db->prepare("DELETE FROM period_locks WHERE id = ?")->execute([$seg[1]]);
        no_content();
    }
    fail('Not found', 404);
}

// ═══════════════════════════ MEDIA ═══════════════════════════
// Files live on disk and are served by Apache at /media/<file>. This endpoint
// handles upload (POST) and delete (DELETE); there is no GET here.
if ($r0 === 'media') {
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
        $file = $MEDIA_DIR . '/' . basename($seg[1]);
        if (is_file($file)) {
            @unlink($file);
        }
        no_content();
    }
    fail('Not found', 404);
}

fail('Not found', 404);

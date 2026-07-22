<?php
// ─────────────────────────────────────────────────────────────────────────────
// LOCAL DEVELOPMENT ONLY — not used on cPanel.
//
// On the real host, Apache + api/.htaccess routes every /api/* request to
// api/index.php and serves /media/* as static files. PHP's built-in server
// ignores .htaccess, so this tiny router reproduces that behaviour locally.
//
// Run it from the PROJECT ROOT (so /media/... resolves):
//   php -S 127.0.0.1:8080 -t . api/router-dev.php
//
// Vite proxies /api and /media here (see vite.config.ts), which keeps the app
// in the same same-origin shape it has in production.
// ─────────────────────────────────────────────────────────────────────────────

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';

if (preg_match('#^/api(/|$)#', $path)) {
    // index.php strips dirname(SCRIPT_NAME) off the route; make it match Apache.
    $_SERVER['SCRIPT_NAME'] = '/api/index.php';
    require __DIR__ . '/index.php';
    return true;
}

// Anything else (i.e. /media/*) — let the built-in server serve the real file.
return false;

<?php
// Copy this file to `config.php` and fill in the first-run setup values.
//
// The SQLite backend needs NO database credentials — the data lives in a file
// (api/data/calendar.sqlite) created automatically on first run. This file sets
// media paths, CORS, and the one-time setup secrets for access control.
//
// config.php is blocked from the web by api/.htaccess, so it is the safe place
// for these values. After the first request creates the admin + first client,
// you can leave them here (they're ignored once accounts exist) or blank them.
return [
    // ── Media: where uploaded photos/videos live and the public URL they map to ──
    'media_dir'    => __DIR__ . '/../media',
    'media_url'    => '/media',

    // ── CORS. '*' mirrors an open API (same-origin deploys don't need it) ──
    'allow_origin' => '*',

    // ── Access control (REQUIRED for first run) ────────────────────────────────
    // Used ONCE, on the very first request, to create the first Apar Team login
    // and the first client workspace (which adopts any existing calendar data).

    // The first Apar Team admin account. Log in with these, then create more team
    // members and clients from the app. Leave admin_password blank and login stays
    // disabled until you set it.
    'admin_username' => 'apar',
    'admin_password' => '',            // ← set a strong password before first load

    // Key used to reversibly encrypt client passwords so the team can view/edit
    // them in the Clients page. Use a long random string. If the host lacks the
    // openssl extension, passwords fall back to plaintext in the (non-web) DB file.
    'secret_key'     => '',            // ← set to a long random string, e.g. 64 hex chars

    // The first client workspace, seeded from your existing calendar data.
    'seed_client_name'     => 'Chheda Jewellers',
    'seed_client_username' => 'chhedas',
    'seed_client_password' => '',      // ← set the client's login password (blank = random)

    // ── Optional ──
    // 'db_file'         => __DIR__ . '/data/calendar.sqlite',
    // 'session_ttl_days' => 14,        // how long a login stays valid (sliding)
];

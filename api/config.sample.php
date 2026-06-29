<?php
// Optional. The SQLite backend needs NO database credentials — the data lives in
// a file (api/data/calendar.sqlite) that is created automatically on first run.
//
// This file only sets where uploaded media lives and CORS. The defaults below
// work for a normal cPanel deploy, so you can leave it as-is (or delete it).
return [
    // Where uploaded photos/videos are stored, and the public URL they map to.
    'media_dir'    => __DIR__ . '/../media',
    'media_url'    => '/media',

    // CORS. '*' mirrors an open API (same-origin deploys don't need it).
    'allow_origin' => '*',

    // Optional: override the SQLite database file location.
    // 'db_file'   => __DIR__ . '/data/calendar.sqlite',
];

<?php

declare(strict_types=1);

return [
    'hmac_key' => env('BANKING_HMAC_KEY'),

    'import_max_bytes' => (int) env('BANKING_IMPORT_MAX_BYTES', 10 * 1024 * 1024),

    'import_max_lines' => (int) env('BANKING_IMPORT_MAX_LINES', 20000),

    'match_window_days' => (int) env('BANKING_MATCH_WINDOW_DAYS', 15),

    'match_window_after_days' => 3,

    'preview_lines' => 20,

    'retention_years' => (int) env('BANKING_RETENTION_YEARS', 10),

    'xsd_directory' => env('BANKING_XSD_DIRECTORY'),

    'xsd_required' => (bool) env('BANKING_XSD_REQUIRED', true),

    'require_trust_account' => (bool) env('BANKING_REQUIRE_TRUST_ACCOUNT', true),

    'timing_chunk' => 1000,

    'book_window_max' => 5000,

    'accept_max' => 50,
];

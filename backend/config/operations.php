<?php

declare(strict_types=1);

return [
    'approval_ttl_hours' => (int) env('OPERATIONS_APPROVAL_TTL_HOURS', 24),

    'backup_max_age_hours' => (int) env('OPERATIONS_BACKUP_MAX_AGE_HOURS', 26),

    'team_address' => env('CONSOLE_TEAM_ADDRESS'),

    'monitoring_url' => env('CONSOLE_MONITORING_URL'),

    'status_page_url' => env('CONSOLE_STATUS_PAGE_URL'),

    'health_probe_timeout_seconds' => 2,

    'health_cache_seconds' => 30,

    'queue_max_age_seconds' => (int) env('OPERATIONS_QUEUE_MAX_AGE_SECONDS', 900),

    'gotenberg_url' => (string) (env('OPERATIONS_GOTENBERG_URL') ?: env('RENT_GOTENBERG_URL', '')),
];

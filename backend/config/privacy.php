<?php

declare(strict_types=1);

return [
    'export_ttl_days' => (int) env('PRIVACY_EXPORT_TTL_DAYS', 30),

    'export_disk' => 'local',

    'export_directory' => 'privacy-exports',

    'team_address' => env('CONSOLE_TEAM_ADDRESS'),
];

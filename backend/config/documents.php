<?php

declare(strict_types=1);

return [
    'image_max_pixels' => (int) env('DOCUMENTS_IMAGE_MAX_PIXELS', 25_000_000),

    'malware' => [
        'scanner' => env('DOCUMENTS_MALWARE_SCANNER', 'none'),
        'clamd_socket' => env('DOCUMENTS_CLAMD_SOCKET', 'unix:///var/run/clamav/clamd.ctl'),
        'timeout_seconds' => (int) env('DOCUMENTS_CLAMD_TIMEOUT', 15),
        'alert_threshold' => (int) env('DOCUMENTS_UNVERIFIABLE_ALERT_THRESHOLD', 20),
        'fake_unavailable' => false,
    ],
];

<?php

declare(strict_types=1);

return [
    'gotenberg' => [
        'url' => (string) (env('REPORTING_GOTENBERG_URL') ?: env('RENT_GOTENBERG_URL', '')),
        'timeout' => min(15, (int) env('REPORTING_GOTENBERG_TIMEOUT', 15)),
    ],

    'batch_max' => (int) env('REPORTING_BATCH_MAX', 50),

    'export_max_rows' => (int) env('REPORTING_EXPORT_MAX_ROWS', 50000),
];

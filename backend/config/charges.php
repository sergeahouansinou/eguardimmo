<?php

declare(strict_types=1);

return [
    'gotenberg' => [
        'url' => (string) (env('CHARGES_GOTENBERG_URL') ?: env('RENT_GOTENBERG_URL', '')),
        'timeout' => min(15, (int) env('CHARGES_GOTENBERG_TIMEOUT', 15)),
    ],

    'third_party_second_approval_minor' => (int) env('CHARGES_THIRD_PARTY_SECOND_APPROVAL_MINOR', 100000),

    'due_after_months' => (int) env('CHARGES_DUE_AFTER_MONTHS', 9),

    'accounting_retention_years' => (int) env('CHARGES_ACCOUNTING_RETENTION_YEARS', 10),

    'export_max_rows' => (int) env('CHARGES_EXPORT_MAX_ROWS', 50000),
];

<?php

declare(strict_types=1);

return [
    'gotenberg' => [
        'url' => (string) (env('TAX_GOTENBERG_URL') ?: env('RENT_GOTENBERG_URL', '')),
        'timeout' => max(1, min(15, (int) env('TAX_GOTENBERG_TIMEOUT', 15))),
    ],

    'retention_years' => (int) env('TAX_RETENTION_YEARS', 6),

    'statements_max_mandants' => max(1, (int) env('TAX_STATEMENTS_MAX_MANDANTS', 10)),
    'statements_time_budget_seconds' => max(0, (int) env('TAX_STATEMENTS_TIME_BUDGET_SECONDS', 90)),

    'export_max_rows' => 5000,

    'sources_max_per_line' => 200,
    'income_year_min' => 2000,
    'income_year_max' => 2100,
];

<?php

declare(strict_types=1);

return [
    'import_max_lines' => min(600, (int) env('INVESTMENTS_IMPORT_MAX_LINES', 600)),

    'accounting_retention_years' => (int) env('INVESTMENTS_RETENTION_YEARS', 10),

    'principal_max_minor' => 100000000000,

    'term_max_months' => 600,
];

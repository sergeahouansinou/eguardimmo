<?php

declare(strict_types=1);

return [
    'gotenberg' => [
        'url' => (string) env('RENT_GOTENBERG_URL', ''),
        'timeout' => (int) env('RENT_GOTENBERG_TIMEOUT', 20),
    ],
];

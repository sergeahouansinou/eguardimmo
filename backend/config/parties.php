<?php

declare(strict_types=1);

return [
    'hmac_key' => (string) env('PARTIES_HMAC_KEY', ''),

    'owner_access_max_per_mandant' => (int) env('OWNER_ACCESS_MAX_PER_MANDANT', 5),
];

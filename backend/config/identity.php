<?php

declare(strict_types=1);

return [
    'hub_url' => rtrim((string) env('AUTH_HUB_URL', 'http://auth.eguardimmo.test:3001'), '/'),

    'return_to_allowed_hosts' => array_values(array_filter(array_map('trim', explode(',', (string) env('AUTH_RETURN_TO_ALLOWED_HOSTS', ''))))),

    'session_absolute_minutes' => (int) env('SESSION_ABSOLUTE_MINUTES', 720),

    'operator_session_absolute_minutes' => (int) env('OPERATOR_SESSION_ABSOLUTE_MINUTES', 60),

    'console_token_ttl_minutes' => (int) env('CONSOLE_TOKEN_TTL_MINUTES', 240),

    'reauthentication_minutes' => (int) env('REAUTHENTICATION_MINUTES', 10),
];

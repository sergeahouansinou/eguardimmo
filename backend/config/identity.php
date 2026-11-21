<?php

declare(strict_types=1);

return [
    'hub_url' => rtrim((string) env('AUTH_HUB_URL', 'http://auth.eguardimmo.test:3001'), '/'),

    'return_to_allowed_hosts' => array_values(array_filter(array_map('trim', explode(',', (string) env('AUTH_RETURN_TO_ALLOWED_HOSTS', ''))))),

    'session_absolute_minutes' => (int) env('SESSION_ABSOLUTE_MINUTES', 720),

    'operator_session_absolute_minutes' => (int) env('OPERATOR_SESSION_ABSOLUTE_MINUTES', 60),

    'console_token_ttl_minutes' => (int) env('CONSOLE_TOKEN_TTL_MINUTES', 240),

    'console_relay_key' => env('CONSOLE_RELAY_KEY'),

    'reauthentication_minutes' => (int) env('REAUTHENTICATION_MINUTES', 10),

    'owner_invitation_days' => (int) env('OWNER_INVITATION_DAYS', 7),

    'owner_invitation_daily_max' => (int) env('OWNER_INVITATION_DAILY_MAX', 100),

    'tenant_invitation_daily_max' => (int) env('TENANT_INVITATION_DAILY_MAX', 100),
];

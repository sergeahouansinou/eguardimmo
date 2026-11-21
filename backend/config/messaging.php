<?php

declare(strict_types=1);

return [
    'support' => [
        'hours' => (string) env('SUPPORT_HOURS', '1-5 09:00-18:00'),
        'timezone' => (string) env('SUPPORT_TIMEZONE', 'Europe/Paris'),
        'response_label' => (string) env('SUPPORT_RESPONSE_LABEL', 'Réponse sous 1 jour ouvré'),
        'emergency_cooldown_hours' => (int) env('SUPPORT_EMERGENCY_COOLDOWN_HOURS', 24),
    ],
];

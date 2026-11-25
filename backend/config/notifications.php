<?php

declare(strict_types=1);

return [
    // Bases https des applications : le lien d'un e-mail est cette base suivie du lien relatif de la notification.
    'urls' => [
        'staff' => env('NOTIFICATIONS_ORGANIZATION_URL'),
        'tenant' => env('NOTIFICATIONS_TENANT_URL'),
        'owner' => env('NOTIFICATIONS_OWNER_URL'),
        'account' => env('NOTIFICATIONS_ACCOUNT_URL'),
    ],

    'push' => [
        // none (défaut : rien ne part) | fcm | fake (tests)
        'driver' => env('NOTIFICATIONS_PUSH_DRIVER', 'none'),
        'per_user_per_hour' => (int) env('NOTIFICATIONS_PUSH_PER_HOUR', 20),
        'fcm' => [
            'project_id' => env('NOTIFICATIONS_FCM_PROJECT_ID'),
            // Chemin d'un fichier de compte de service hors dépôt, jamais son contenu.
            'credentials' => env('NOTIFICATIONS_FCM_CREDENTIALS'),
            'timeout' => (int) env('NOTIFICATIONS_FCM_TIMEOUT', 5),
        ],
    ],

    'campaigns' => [
        // Fournisseur d'e-mail des diffusions : vide (aucun envoi réel) | mailtrap. ADR 0033, décision 13.
        'provider' => env('MAIL_PROVIDER'),
        // Mailer Laravel du flux Bulk ; le flux transactionnel reste le mailer par défaut.
        'bulk_mailer' => env('MAIL_BULK_MAILER', 'mailtrap_bulk'),
        'from_address' => env('DIFFUSION_FROM_ADDRESS'),
        // Clé HMAC des liens de désinscription : sans elle, aucun envoi.
        'unsubscribe_key' => env('MAIL_UNSUBSCRIBE_KEY'),
        'unsubscribe_ttl_days' => (int) env('MAIL_UNSUBSCRIBE_TTL_DAYS', 400),
        'daily_recipients' => (int) env('CAMPAIGN_DAILY_RECIPIENTS', 2000),
        'hourly_sends' => (int) env('CAMPAIGN_HOURLY_SENDS', 10),
        'hourly_tests' => (int) env('CAMPAIGN_HOURLY_TESTS', 5),
        'batch_size' => 100,
        'stale_minutes' => 30,
        'webhook_secrets' => [
            'mailtrap' => env('MAIL_WEBHOOK_SECRET_MAILTRAP'),
        ],
    ],
    'marketing' => [
        'max_recipients' => (int) env('MARKETING_MAX_RECIPIENTS', 20000),
    ],
    'reminders' => [
        'max_per_run' => (int) env('REMINDERS_MAX_PER_RUN', 2000),
    ],
    'rate_limits' => [
        'read_per_minute' => (int) env('NOTIFICATIONS_READ_PER_MINUTE', 120),
        'write_per_minute' => (int) env('NOTIFICATIONS_WRITE_PER_MINUTE', 60),
        'push_token_per_minute' => (int) env('NOTIFICATIONS_PUSH_TOKEN_PER_MINUTE', 10),
    ],
];

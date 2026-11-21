<?php

declare(strict_types=1);

return [
    'gateway' => env('PAYMENTS_GATEWAY', 'none'),
    'return_url' => env('PAYMENTS_RETURN_URL', 'http://locataire.eguardimmo.test:3002/paiement/retour'),
    'methods' => ['card'],
    'reconcile_after_hours' => 24,
    'replay_confirmed_days' => 30,
    'reconcile_batch' => 500,
    'expire_unknown_after_days' => 7,
    'providers' => [
        'fake' => ['webhook_secret' => env('PAYMENTS_FAKE_WEBHOOK_SECRET')],
        'stripe' => ['secret_key' => env('PAYMENTS_STRIPE_SECRET_KEY'), 'webhook_secret' => env('PAYMENTS_STRIPE_WEBHOOK_SECRET')],
    ],
];

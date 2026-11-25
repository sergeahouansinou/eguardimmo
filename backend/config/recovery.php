<?php

declare(strict_types=1);

return [
    'gotenberg' => [
        'url' => (string) (env('RECOVERY_GOTENBERG_URL') ?: env('RENT_GOTENBERG_URL', '')),
        'timeout' => (int) env('RECOVERY_GOTENBERG_TIMEOUT', env('RENT_GOTENBERG_TIMEOUT', 20)),
    ],

    'rate_limits' => [
        // Lien public : par IP réelle uniquement, seau distinct de celui de la connexion.
        'download_per_minute' => (int) env('RECOVERY_DOWNLOAD_PER_MINUTE', 5),
        // Génération d'un envoi (trois rendus PDF) : par organisation et par utilisateur.
        'generation_per_minute' => (int) env('RECOVERY_GENERATION_PER_MINUTE', 6),
    ],

    'transmission' => [
        'default_days' => 7,
        'max_days' => 30,
        // Modèle de l'adresse https de la page publique ; {token} est remplacé par le jeton. Vide : route de l'API.
        'link_url' => env('RECOVERY_LINK_URL'),
    ],
];

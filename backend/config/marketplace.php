<?php

declare(strict_types=1);

return [
    // Frais de service ajoutés au sous-total, en centièmes de pour cent (150 = 1,5 %). [À RENSEIGNER] : 0 tant que le tarif n'est pas arrêté (ADR 0013).
    'service_fee_basis_points' => (int) env('MARKETPLACE_SERVICE_FEE_BASIS_POINTS', 0),

    'pending_payment_minutes' => 30,

    'max_nights' => 90,

    // Fuseau qui date « aujourd'hui » pour les arrivées et les annulations : celui des logements, pas celui du serveur.
    'timezone' => env('MARKETPLACE_TIMEZONE', 'Europe/Paris'),

    // Clé partagée avec le serveur de SeBook, seul autorisé à annoncer l'IP de ses visiteurs sur les lectures d'annonces.
    'sebook_relay_key' => env('SEBOOK_RELAY_KEY'),

    // Organisation qui reçoit les annonces de MarketplaceDemoSeeder (développement uniquement).
    'demo_organization_id' => env('MARKETPLACE_DEMO_ORGANIZATION'),
];

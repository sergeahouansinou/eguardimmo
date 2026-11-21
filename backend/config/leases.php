<?php

declare(strict_types=1);

return [
    'gotenberg' => [
        'url' => (string) (env('LEASES_GOTENBERG_URL') ?: env('RENT_GOTENBERG_URL', '')),
        'timeout' => min(15, (int) env('LEASES_GOTENBERG_TIMEOUT', 15)),
    ],

    'notice' => [
        'ack_business_days' => max(1, (int) env('TENANT_NOTICE_ACK_BUSINESS_DAYS', 2)),
        'consent_version' => '2026-11-v1',
        'to_confirm' => true,
        'consent_text' => 'Je demande à mon agence de prendre acte de mon congé et d\'en accuser réception. Je comprends que la date de départ affichée est indicative tant que l\'agence n\'a pas accusé réception, et qu\'un congé donné ne se retire pas sans l\'accord du bailleur une fois la réception actée.',
        'legal_notice' => 'Texte à confirmer par un juriste. Le préavis court du jour de la réception ou de la remise du congé. Un simple e-mail ne vaut pas congé : si l\'agence n\'accuse pas réception rapidement, envoyez la lettre générée par lettre recommandée avec avis de réception.',
    ],
];

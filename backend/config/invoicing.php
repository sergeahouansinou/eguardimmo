<?php

declare(strict_types=1);

return [
    'gotenberg' => [
        'url' => (string) (env('INVOICING_GOTENBERG_URL') ?: env('RENT_GOTENBERG_URL', '')),
        'timeout' => (int) env('INVOICING_GOTENBERG_TIMEOUT', env('RENT_GOTENBERG_TIMEOUT', 15)),
    ],

    // Plafonds d'envoi d'une facture par e-mail, en plus de 10 par minute et par utilisateur (ADR 0028).
    'send' => [
        'per_invoice_per_hour' => (int) env('INVOICING_SEND_PER_INVOICE_PER_HOUR', 3),
        'per_organization_per_hour' => (int) env('INVOICING_SEND_PER_ORGANIZATION_PER_HOUR', 60),
    ],

    // Délai de règlement quand ni l'organisation ni la facture n'en fixent un (plafond légal à vérifier, ADR 0028).
    'payment_terms_days' => 30,

    // Dates d'entrée de l'obligation d'émettre en facture électronique entre assujettis, par juridiction : des données,
    // à confirmer sur impots.gouv.fr. Une agence est une PME ou une TPE : 1er septembre 2027 (grandes entreprises et ETI : 1er septembre 2026).
    'e_invoicing' => [
        'FR' => ['from' => (string) env('INVOICING_EINVOICING_FR_FROM', '2027-09-01')],
    ],
];

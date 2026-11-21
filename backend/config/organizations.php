<?php

declare(strict_types=1);

return [
    'activity' => [
        'retention_months' => (int) env('ORGANIZATIONS_ACTIVITY_RETENTION_MONTHS', 12),
        'export_max_rows' => (int) env('ORGANIZATIONS_ACTIVITY_EXPORT_MAX_ROWS', 50000),
    ],

    // Plafond d'organisations créées (donc possédées) par un même compte : freine la création en série d'organisations et de périodes d'essai.
    'creation' => [
        'max_owned_per_user' => (int) env('ORGANIZATIONS_MAX_OWNED_PER_USER', 5),
    ],

    // Chaque invitation ou renvoi envoie un e-mail sous le nom de la plateforme : plafonds par organisation, par adresse invitée et par invitation.
    'invitations' => [
        'organization_hourly_max' => (int) env('ORGANIZATIONS_INVITATION_ORGANIZATION_HOURLY_MAX', 30),
        'organization_daily_max' => (int) env('ORGANIZATIONS_INVITATION_ORGANIZATION_DAILY_MAX', 100),
        'address_daily_max' => (int) env('ORGANIZATIONS_INVITATION_ADDRESS_DAILY_MAX', 3),
        'resend_delay_seconds' => (int) env('ORGANIZATIONS_INVITATION_RESEND_DELAY_SECONDS', 60),
        'resend_daily_max' => (int) env('ORGANIZATIONS_INVITATION_RESEND_DAILY_MAX', 3),
    ],
];

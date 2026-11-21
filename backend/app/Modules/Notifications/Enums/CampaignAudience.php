<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Enums;

enum CampaignAudience: string
{
    case Tenants = 'tenants';
    case Mandants = 'mandants';

    public function label(): string
    {
        return match ($this) {
            self::Tenants => 'Tous les locataires',
            self::Mandants => 'Tous les mandants',
        };
    }

    public function detail(): string
    {
        return match ($this) {
            self::Tenants => 'Locataires des baux signés en cours, par immeuble au choix',
            self::Mandants => 'Mandants des mandats actifs',
        };
    }
}

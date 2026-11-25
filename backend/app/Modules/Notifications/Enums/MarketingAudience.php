<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Enums;

enum MarketingAudience: string
{
    case AllAccounts = 'all_accounts';
    case AgencyMembers = 'agency_members';
    case IndividualLandlords = 'individual_landlords';
    case Tenants = 'tenants';
    case Owners = 'owners';
    case Travelers = 'travelers';
    case InactiveAccounts = 'inactive_accounts';
    case Selected = 'selected';

    public function acceptsInactivityDays(): bool
    {
        return $this === self::InactiveAccounts;
    }

    public function label(): string
    {
        return match ($this) {
            self::AllAccounts => 'Tous les comptes',
            self::AgencyMembers => 'Membres des agences',
            self::IndividualLandlords => 'Propriétaires bailleurs',
            self::Tenants => 'Locataires',
            self::Owners => 'Propriétaires mandants',
            self::Travelers => 'Voyageurs',
            self::InactiveAccounts => 'Comptes inactifs',
            self::Selected => 'Comptes choisis',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::AllAccounts => 'Tous les comptes confirmés et actifs.',
            self::AgencyMembers => 'Membres actifs d\'une agence.',
            self::IndividualLandlords => 'Membres actifs d\'un espace de bailleur autonome.',
            self::Tenants => 'Comptes rattachés à une fiche de locataire.',
            self::Owners => 'Comptes avec un accès propriétaire mandant en cours.',
            self::Travelers => 'Comptes inscrits comme voyageurs.',
            self::InactiveAccounts => 'Comptes sans activité depuis le nombre de jours choisi.',
            self::Selected => 'Comptes désignés par leur adresse e-mail exacte.',
        };
    }
}

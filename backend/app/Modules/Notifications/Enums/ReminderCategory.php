<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Enums;

enum ReminderCategory: string
{
    case Account = 'account';
    case Journey = 'journey';
    case Tenant = 'tenant';
    case Team = 'team';

    public function label(): string
    {
        return match ($this) {
            self::Account => 'Comptes',
            self::Journey => 'Parcours de démarrage',
            self::Tenant => 'Locataires',
            self::Team => 'Équipes',
        };
    }
}

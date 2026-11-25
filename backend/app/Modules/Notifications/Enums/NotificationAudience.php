<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Enums;

enum NotificationAudience: string
{
    case Staff = 'staff';
    case Tenant = 'tenant';
    case Owner = 'owner';
    case Account = 'account';

    public function label(): string
    {
        return match ($this) {
            self::Staff => 'Équipe',
            self::Tenant => 'Locataire',
            self::Owner => 'Propriétaire mandant',
            self::Account => 'Compte',
        };
    }
}

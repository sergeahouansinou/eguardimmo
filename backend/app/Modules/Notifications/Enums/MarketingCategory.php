<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Enums;

enum MarketingCategory: string
{
    case Marketing = 'marketing';
    case Service = 'service';

    public function notificationType(): NotificationType
    {
        return match ($this) {
            self::Marketing => NotificationType::AccountMarketing,
            self::Service => NotificationType::AccountServiceMessage,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Marketing => 'Marketing',
            self::Service => 'Information de service',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::Marketing => 'Offres et nouveautés : seuls les comptes qui ont donné leur accord la reçoivent.',
            self::Service => 'Information utile à l\'usage du service, sans contenu commercial : désactivable par le destinataire.',
        };
    }
}

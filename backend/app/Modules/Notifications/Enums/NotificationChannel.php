<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Enums;

enum NotificationChannel: string
{
    case InApp = 'in_app';
    case Email = 'email';
    case Push = 'push';

    public function label(): string
    {
        return match ($this) {
            self::InApp => 'Application',
            self::Email => 'E-mail',
            self::Push => 'Mobile',
        };
    }
}

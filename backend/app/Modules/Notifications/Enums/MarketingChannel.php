<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Enums;

enum MarketingChannel: string
{
    case Email = 'email';
    case Push = 'push';

    public function notificationChannel(): NotificationChannel
    {
        return match ($this) {
            self::Email => NotificationChannel::Email,
            self::Push => NotificationChannel::Push,
        };
    }
}

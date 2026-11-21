<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Data;

use App\Modules\Notifications\Enums\NotificationChannel;
use App\Modules\Notifications\Enums\NotificationType;

final readonly class PreferenceChange
{
    public function __construct(
        public NotificationType $type,
        public NotificationChannel $channel,
        public bool $enabled,
    ) {}
}

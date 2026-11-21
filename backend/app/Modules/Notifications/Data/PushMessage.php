<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Data;

final readonly class PushMessage
{
    public function __construct(
        public string $title,
        public string $body,
        public string $notificationId,
        public ?string $link,
    ) {}
}

<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Data;

final readonly class NotificationFilters
{
    public function __construct(
        public bool $unreadOnly = false,
        public ?string $organizationId = null,
    ) {}
}

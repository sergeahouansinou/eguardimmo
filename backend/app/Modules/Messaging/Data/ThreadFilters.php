<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Data;

use App\Modules\Messaging\Enums\InboxTab;
use Carbon\CarbonImmutable;

final readonly class ThreadFilters
{
    public function __construct(
        public int $perPage,
        public ?string $cursor,
        public ?CarbonImmutable $since = null,
        public ?string $search = null,
        public ?InboxTab $tab = null,
        public bool $unreadOnly = false,
        public bool $archived = false,
        public ?string $leaseId = null,
    ) {}
}

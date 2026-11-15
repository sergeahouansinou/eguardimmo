<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Data;

use App\Modules\Messaging\Enums\InboxTab;

final readonly class ConversationFilters
{
    public function __construct(
        public InboxTab $tab,
        public ?string $search,
        public int $page,
        public int $perPage,
    ) {}
}

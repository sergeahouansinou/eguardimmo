<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Data;

use App\Modules\Messaging\Enums\RequesterSpace;
use App\Modules\Messaging\Enums\TicketPriority;
use App\Modules\Messaging\Enums\TicketStatus;

final readonly class TicketFilters
{
    public function __construct(
        public ?TicketStatus $status,
        public ?TicketPriority $priority,
        public ?string $assigneeUserId,
        public bool $unassigned,
        public ?string $search,
        public int $page,
        public int $perPage,
        public ?RequesterSpace $space = null,
        public ?string $organizationId = null,
    ) {}
}

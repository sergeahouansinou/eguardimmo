<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Data;

use App\Modules\Messaging\Enums\TicketPriority;
use App\Modules\Messaging\Enums\TicketStatus;

final readonly class TicketPatchData
{
    public function __construct(
        public ?TicketStatus $status,
        public ?TicketPriority $priority,
        public bool $assigneeProvided,
        public ?string $assigneeUserId,
        public bool $read = false,
    ) {}
}

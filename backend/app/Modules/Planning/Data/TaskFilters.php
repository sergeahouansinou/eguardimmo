<?php

declare(strict_types=1);

namespace App\Modules\Planning\Data;

use App\Modules\Planning\Enums\TaskStatus;

final readonly class TaskFilters
{
    public function __construct(
        public ?TaskStatus $status,
        public ?string $assigneeUserId,
        public ?string $propertyId,
        public ?string $unitId,
        public ?string $dueFrom,
        public ?string $dueTo,
        public bool $overdue,
        public int $perPage,
    ) {}
}

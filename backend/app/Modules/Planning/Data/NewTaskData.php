<?php

declare(strict_types=1);

namespace App\Modules\Planning\Data;

final readonly class NewTaskData
{
    public function __construct(
        public string $title,
        public string $dueOn,
        public ?string $assigneeUserId,
        public ?int $remindDaysBefore,
        public ?string $propertyId,
        public ?string $unitId,
        public ?string $leaseId,
        public ?string $clientId,
    ) {}
}

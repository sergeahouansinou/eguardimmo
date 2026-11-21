<?php

declare(strict_types=1);

namespace App\Modules\Planning\Data;

use App\Modules\Planning\Enums\TaskStatus;
use Carbon\CarbonInterface;

final readonly class TaskViewData
{
    public function __construct(
        public string $id,
        public string $title,
        public string $dueOn,
        public TaskStatus $status,
        public bool $isOverdue,
        public ?string $assigneeUserId,
        public ?bool $assigneeActive,
        public ?CarbonInterface $doneAt,
        public ?string $doneByUserId,
        public ?int $remindDaysBefore,
        public ?string $propertyId,
        public ?string $unitId,
        public ?string $leaseId,
        public string $createdByUserId,
        public int $lockVersion,
    ) {}
}

<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Data;

use App\Modules\Maintenance\Enums\Priority;
use App\Modules\Maintenance\Enums\Responsibility;

final readonly class QualifyData
{
    /**
     * @param  array<string, mixed>|null  $customFields
     */
    public function __construct(
        public int $lockVersion,
        public ?string $natureTermId,
        public Priority $priority,
        public Responsibility $responsibility,
        public ?string $unitId,
        public bool $commonArea,
        public ?string $mandateId,
        public ?string $dueOn,
        public ?int $estimatedAmount,
        public ?string $room,
        public ?array $customFields,
    ) {}
}

<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Data;

use App\Modules\Maintenance\Enums\Priority;
use App\Modules\Maintenance\Enums\ReportedUrgency;

final readonly class NewInterventionData
{
    public function __construct(
        public ?string $leaseId,
        public ?string $unitId,
        public bool $commonArea,
        public ?string $mandateId,
        public string $natureTermId,
        public string $title,
        public string $description,
        public ?string $room,
        public ?ReportedUrgency $reportedUrgency,
        public ?Priority $priority,
        public ?string $availability,
        public string $idempotencyKey,
    ) {}
}

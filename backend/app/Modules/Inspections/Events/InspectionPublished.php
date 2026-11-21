<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

final readonly class InspectionPublished implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $inspectionId,
        public string $leaseId,
        public string $organizationId,
        public string $kind,
    ) {}
}

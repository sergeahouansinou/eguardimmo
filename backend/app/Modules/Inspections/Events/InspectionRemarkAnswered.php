<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

final readonly class InspectionRemarkAnswered implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $remarkId,
        public string $inspectionId,
        public string $leaseId,
        public string $organizationId,
        public string $partyId,
        public string $answer,
    ) {}
}

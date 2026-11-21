<?php

declare(strict_types=1);

namespace App\Modules\Leases\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

final readonly class LeaseInsuranceSubmitted implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $submissionId,
        public string $leaseId,
        public string $organizationId,
    ) {}
}

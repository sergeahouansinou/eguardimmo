<?php

declare(strict_types=1);

namespace App\Modules\Leases\Events;

use App\Modules\Leases\Enums\NoticeRequestOutcome;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

final readonly class NoticeRequestClosed implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $requestId,
        public string $leaseId,
        public string $organizationId,
        public string $partyId,
        public NoticeRequestOutcome $outcome,
    ) {}
}

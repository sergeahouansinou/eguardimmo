<?php

declare(strict_types=1);

namespace App\Modules\Payments\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

final readonly class OnlinePaymentFailed implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $onlinePaymentId,
        public string $organizationId,
        public string $leaseId,
        public string $partyId,
    ) {}
}

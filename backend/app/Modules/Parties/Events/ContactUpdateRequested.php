<?php

declare(strict_types=1);

namespace App\Modules\Parties\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

final readonly class ContactUpdateRequested implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $requestId,
        public string $partyId,
        public string $organizationId,
    ) {}
}

<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

final readonly class OrganizationSuspended implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(public string $organizationId, public string $approvalId) {}
}

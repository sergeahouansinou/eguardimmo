<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

final readonly class ManagementReportPublished implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $reportId,
        public string $organizationId,
        public string $mandantPartyId,
        public bool $notify,
        public bool $rectification,
    ) {}
}

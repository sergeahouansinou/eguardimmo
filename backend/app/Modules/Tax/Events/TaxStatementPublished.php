<?php

declare(strict_types=1);

namespace App\Modules\Tax\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

final readonly class TaxStatementPublished implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $summaryId,
        public string $organizationId,
        public string $mandantPartyId,
        public int $incomeYear,
    ) {}
}

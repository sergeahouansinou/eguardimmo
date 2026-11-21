<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Data;

use App\Modules\Recovery\Enums\CaseStatus;

final readonly class CaseFilters
{
    public function __construct(
        public ?CaseStatus $status = null,
        public ?string $leaseId = null,
        public ?string $debtorPartyId = null,
        public ?string $cursor = null,
    ) {}
}

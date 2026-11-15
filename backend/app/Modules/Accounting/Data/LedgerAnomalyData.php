<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Data;

use App\Modules\Accounting\Enums\AnomalyKind;

final readonly class LedgerAnomalyData
{
    public function __construct(
        public AnomalyKind $kind,
        public string $organizationId,
        public ?string $entryId,
        public string $detail,
    ) {}
}

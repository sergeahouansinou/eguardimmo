<?php

declare(strict_types=1);

namespace App\Modules\Charges\Data;

use App\Modules\Charges\Enums\AnomalyKind;

final readonly class ChargeAnomalyData
{
    public function __construct(
        public AnomalyKind $kind,
        public string $organizationId,
        public string $subjectId,
        public string $detail,
    ) {}
}

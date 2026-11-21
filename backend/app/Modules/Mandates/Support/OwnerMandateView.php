<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Support;

use App\Modules\Mandates\Data\OwnerVisibleData;
use App\Modules\Mandates\Models\MandateEndRequest;

final readonly class OwnerMandateView
{
    public function __construct(
        public MandateView $view,
        public ?string $agencyName,
        public OwnerVisibleData $visible,
        public ?MandateEndRequest $endRequest = null,
    ) {}
}

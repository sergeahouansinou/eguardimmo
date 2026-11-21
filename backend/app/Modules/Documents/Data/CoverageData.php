<?php

declare(strict_types=1);

namespace App\Modules\Documents\Data;

use App\Modules\Documents\Enums\CoverageState;
use Carbon\CarbonImmutable;

final readonly class CoverageData
{
    public function __construct(
        public CoverageState $state,
        public ?CarbonImmutable $endsOn,
    ) {}
}

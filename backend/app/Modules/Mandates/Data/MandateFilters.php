<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Data;

use App\Modules\Mandates\Enums\MandateStatus;

final readonly class MandateFilters
{
    public function __construct(
        public ?MandateStatus $status = null,
        public ?string $mandantPartyId = null,
        public ?string $unitId = null,
        public bool $archived = false,
        public bool $endRequestPending = false,
        public ?string $search = null,
        public ?string $cursor = null,
    ) {}
}

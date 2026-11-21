<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Data;

use App\Modules\Organizations\Enums\ActivityType;
use Carbon\CarbonImmutable;

final readonly class ActivityFilters
{
    public function __construct(
        public CarbonImmutable $from,
        public ?CarbonImmutable $to,
        public ?string $actorId = null,
        public ?ActivityType $type = null,
        public ?string $subjectType = null,
        public ?string $subjectId = null,
        public int $perPage = 25,
    ) {}
}

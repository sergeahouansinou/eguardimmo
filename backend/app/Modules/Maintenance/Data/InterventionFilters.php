<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Data;

final readonly class InterventionFilters
{
    public function __construct(
        public ?string $status,
        public ?string $priority,
        public ?string $unitId,
        public ?string $supplierPartyId,
        public ?string $origin,
        public bool $overdue,
        public ?string $search,
        public ?string $dueFrom,
        public ?string $dueTo,
        public ?string $cursor,
        public int $perPage,
    ) {}
}

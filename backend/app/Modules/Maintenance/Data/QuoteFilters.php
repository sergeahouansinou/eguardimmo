<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Data;

final readonly class QuoteFilters
{
    /**
     * @param  list<string>  $statuses
     */
    public function __construct(
        public array $statuses,
        public ?string $interventionId,
        public ?string $supplierPartyId,
        public ?string $cursor,
        public int $perPage,
    ) {}
}

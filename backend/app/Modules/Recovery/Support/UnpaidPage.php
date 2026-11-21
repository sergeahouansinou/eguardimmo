<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Support;

use App\Modules\Leases\Data\LeaseData;
use App\Modules\Parties\Data\PartyData;
use App\Modules\Recovery\Data\Receivable;

final readonly class UnpaidPage
{
    /**
     * @param  list<Receivable>  $items
     * @param  array<string, LeaseData>  $leases
     * @param  array<string, PartyData>  $parties
     * @param  array<string, array{id: string, number: string}>  $cases  dossier actif par créance
     */
    public function __construct(
        public array $items,
        public array $leases,
        public array $parties,
        public array $cases,
        public ?string $nextAfter,
    ) {}
}

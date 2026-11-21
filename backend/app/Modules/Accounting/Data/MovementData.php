<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Data;

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\SourceType;
use Money\Money;

final readonly class MovementData
{
    /**
     * Total d'un compte pour une partie, un lot, un mois et un type de source. Une contrepassation est rattachée au type
     * de source de l'écriture qu'elle annule : elle vient en déduction du même total.
     *
     * @param  string  $month  Y-m
     */
    public function __construct(
        public ?string $partyId,
        public ?string $unitId,
        public string $month,
        public AccountRole $role,
        public SourceType $source,
        public Money $debit,
        public Money $credit,
    ) {}
}

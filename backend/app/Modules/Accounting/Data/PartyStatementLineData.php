<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Data;

use App\Modules\Accounting\Enums\SourceType;
use Carbon\CarbonImmutable;
use Money\Money;

final readonly class PartyStatementLineData
{
    /**
     * `source` et `sourceId` désignent la pièce d'origine : pour une contrepassation, celle de l'écriture annulée.
     */
    public function __construct(
        public string $entryId,
        public string $reference,
        public CarbonImmutable $date,
        public SourceType $source,
        public string $sourceId,
        public ?string $unitId,
        public ?string $leaseId,
        public string $label,
        public bool $isReversal,
        public Money $debit,
        public Money $credit,
        public Money $balance,
    ) {}
}

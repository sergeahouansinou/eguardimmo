<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Data;

use App\Modules\Accounting\Enums\Journal;
use App\Modules\Accounting\Enums\Side;
use App\Modules\Accounting\Enums\SourceType;
use Money\Money;

final readonly class BankBookLineData
{
    /**
     * @param  string  $entryDate  Y-m-d
     * @param  Money  $amount  toujours positif ; le sens est porté par `$side`
     * @param  bool  $isReversal  l'écriture est elle-même une contrepassation
     * @param  bool  $isReversed  une contrepassation de l'écriture existe
     */
    public function __construct(
        public string $lineId,
        public string $entryId,
        public string $entryReference,
        public string $entryDate,
        public string $entryLabel,
        public Journal $journal,
        public Side $side,
        public Money $amount,
        public SourceType $sourceType,
        public string $sourceId,
        public bool $isReversal,
        public bool $isReversed,
    ) {}
}

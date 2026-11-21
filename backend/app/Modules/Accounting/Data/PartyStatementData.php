<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Data;

use Carbon\CarbonImmutable;
use Money\Money;

final readonly class PartyStatementData
{
    /**
     * Relevé d'un compte pour une partie, dans le sens normal du compte : `opening` avant `from`, `closing` après `to`.
     *
     * @param  list<PartyStatementLineData>  $lines
     */
    public function __construct(
        public string $partyId,
        public CarbonImmutable $from,
        public CarbonImmutable $to,
        public Money $opening,
        public array $lines,
        public Money $closing,
    ) {}
}

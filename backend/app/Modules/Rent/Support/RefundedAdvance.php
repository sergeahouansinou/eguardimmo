<?php

declare(strict_types=1);

namespace App\Modules\Rent\Support;

use App\Modules\Rent\Models\AdvanceRefund;
use Money\Money;

final readonly class RefundedAdvance
{
    /**
     * @param  list<AdvanceRefund>  $refunds  une ligne par encaissement entamé
     */
    public function __construct(
        public array $refunds,
        public Money $total,
        public bool $replayed,
    ) {}
}

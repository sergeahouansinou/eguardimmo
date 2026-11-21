<?php

declare(strict_types=1);

namespace App\Modules\Payments\Data;

use App\Modules\Rent\Data\PayableInstallmentData;
use Money\Money;

final readonly class PaymentOptionsData
{
    /**
     * @param  list<string>  $methods
     * @param  list<PayableInstallmentData>  $installments
     */
    public function __construct(
        public ?string $unavailableReason,
        public array $methods,
        public array $installments,
        public ?Money $total,
    ) {}

    public function available(): bool
    {
        return $this->unavailableReason === null;
    }
}

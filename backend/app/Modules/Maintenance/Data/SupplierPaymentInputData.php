<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Data;

use App\Modules\Maintenance\Enums\SupplierPaymentMethod;

final readonly class SupplierPaymentInputData
{
    public function __construct(
        public int $amount,
        public SupplierPaymentMethod $method,
        public string $paidOn,
        public ?string $reference,
        public string $idempotencyKey,
        public bool $ownFundsAdvance = false,
    ) {}
}

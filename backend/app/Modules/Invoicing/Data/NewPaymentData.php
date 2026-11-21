<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Data;

use App\Modules\Invoicing\Enums\PaymentMethod;

final readonly class NewPaymentData
{
    /**
     * @param  int  $amount  unités mineures de la devise de la facture : la devise ne vient jamais du client
     * @param  string  $paidOn  Y-m-d
     */
    public function __construct(
        public int $amount,
        public PaymentMethod $method,
        public string $paidOn,
        public ?string $reference,
        public string $idempotencyKey,
    ) {}
}

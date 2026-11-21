<?php

declare(strict_types=1);

namespace App\Modules\Payments\Data;

final readonly class CheckoutRequestData
{
    /**
     * @param  int  $amount  unités mineures de $currency
     */
    public function __construct(
        public string $onlinePaymentId,
        public string $connectedAccountId,
        public int $amount,
        public string $currency,
        public string $method,
        public string $returnUrl,
    ) {}
}

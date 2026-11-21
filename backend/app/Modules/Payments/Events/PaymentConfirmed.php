<?php

declare(strict_types=1);

namespace App\Modules\Payments\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

final readonly class PaymentConfirmed implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    /**
     * @param  int  $amount  unités mineures de $currency
     * @param  string  $confirmedOn  Y-m-d
     */
    public function __construct(
        public string $onlinePaymentId,
        public string $organizationId,
        public string $leaseId,
        public string $partyId,
        public string $provider,
        public string $providerReference,
        public int $amount,
        public string $currency,
        public string $method,
        public string $confirmedOn,
    ) {}

    public function idempotencyKey(): string
    {
        return 'psp:'.$this->provider.':'.$this->providerReference;
    }
}

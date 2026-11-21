<?php

declare(strict_types=1);

namespace App\Modules\Rent\Data;

use App\Modules\Rent\Enums\PaymentMethod;

final readonly class NewPaymentData
{
    /**
     * @param  int  $amount  unités mineures de la devise du bail : la devise ne vient jamais du client
     * @param  string  $receivedOn  Y-m-d
     */
    public function __construct(
        public string $leaseId,
        public int $amount,
        public PaymentMethod $method,
        public string $receivedOn,
        public ?string $reference,
        public ?string $note,
        public string $idempotencyKey,
        public ?string $providerReference = null,
        public ?string $partyId = null,
    ) {}
}

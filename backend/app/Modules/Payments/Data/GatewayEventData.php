<?php

declare(strict_types=1);

namespace App\Modules\Payments\Data;

use App\Modules\Payments\Enums\OnlinePaymentStatus;

/**
 * Événement d'un fournisseur dont la signature est vérifiée ; `status` est nul pour un type que la plateforme ignore.
 */
final readonly class GatewayEventData
{
    public function __construct(
        public string $eventId,
        public string $type,
        public ?string $providerReference,
        public ?OnlinePaymentStatus $status,
        public ?int $amount,
        public ?string $currency,
        public ?string $failureCode,
    ) {}
}

<?php

declare(strict_types=1);

namespace App\Modules\Payments\Data;

use App\Modules\Payments\Enums\OnlinePaymentStatus;

final readonly class GatewayPaymentStateData
{
    public function __construct(
        public OnlinePaymentStatus $status,
        public ?int $amount,
        public ?string $currency = null,
    ) {}
}

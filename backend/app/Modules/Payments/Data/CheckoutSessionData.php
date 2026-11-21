<?php

declare(strict_types=1);

namespace App\Modules\Payments\Data;

final readonly class CheckoutSessionData
{
    public function __construct(
        public string $providerReference,
        public string $redirectUrl,
    ) {}
}

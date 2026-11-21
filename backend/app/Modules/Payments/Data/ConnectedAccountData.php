<?php

declare(strict_types=1);

namespace App\Modules\Payments\Data;

final readonly class ConnectedAccountData
{
    public function __construct(
        public string $accountId,
        public bool $ready,
        public ?string $onboardingUrl,
    ) {}
}

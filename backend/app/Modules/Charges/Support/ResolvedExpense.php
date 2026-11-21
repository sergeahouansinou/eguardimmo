<?php

declare(strict_types=1);

namespace App\Modules\Charges\Support;

final readonly class ResolvedExpense
{
    public function __construct(
        public string $currency,
        public string $categoryKey,
        public ?string $mandateId,
        public ?string $mandantPartyId,
    ) {}
}

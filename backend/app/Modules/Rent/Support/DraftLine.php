<?php

declare(strict_types=1);

namespace App\Modules\Rent\Support;

use App\Modules\Rent\Enums\LineSemantic;
use Carbon\CarbonImmutable;
use Money\Money;

final readonly class DraftLine
{
    public function __construct(
        public string $componentKey,
        public LineSemantic $semantic,
        public string $label,
        public CarbonImmutable $from,
        public CarbonImmutable $to,
        public int $days,
        public int $monthDays,
        public Money $monthly,
        public Money $amount,
        public int $vatBp,
        public Money $vat,
    ) {}

    public function isRent(): bool
    {
        return $this->semantic->isRent();
    }
}

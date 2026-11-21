<?php

declare(strict_types=1);

namespace App\Modules\Investments\Data;

use App\Modules\Investments\Enums\PrepaymentOption;

final readonly class PrepaymentData
{
    public function __construct(
        public string $date,
        public int $amount,
        public PrepaymentOption $option,
        public int $penalty,
        public int $lockVersion,
    ) {}
}

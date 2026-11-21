<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Data;

final readonly class RenewMandateData
{
    public function __construct(
        public int $lockVersion,
        public int $months,
    ) {}
}

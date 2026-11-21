<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Data;

final readonly class EndMandateUnitData
{
    /**
     * @param  string  $endDate  dernier jour de couverture du lot, inclus (Y-m-d)
     */
    public function __construct(
        public int $lockVersion,
        public string $endDate,
    ) {}
}

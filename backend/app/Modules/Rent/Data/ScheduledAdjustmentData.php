<?php

declare(strict_types=1);

namespace App\Modules\Rent\Data;

final readonly class ScheduledAdjustmentData
{
    /**
     * @param  string  $mode  `pending` : ligne en attente de la prochaine échéance ; `installment` : échéance ponctuelle créée
     */
    public function __construct(
        public int $position,
        public string $mode,
        public ?string $installmentId,
    ) {}
}

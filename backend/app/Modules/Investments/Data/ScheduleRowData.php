<?php

declare(strict_types=1);

namespace App\Modules\Investments\Data;

final readonly class ScheduleRowData
{
    /**
     * @param  string  $dueOn  Y-m-d
     * @param  int  $payment  mensualité hors assurance (intérêts + capital), unités mineures ; nulle en différé total
     * @param  int  $interest  intérêts de l'échéance (capitalisés en différé total)
     * @param  int  $principal  capital amorti, remboursement anticipé compris
     */
    public function __construct(
        public string $dueOn,
        public int $payment,
        public int $interest,
        public int $principal,
        public int $insurance,
        public int $outstandingAfter,
    ) {}
}

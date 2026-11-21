<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Data;

use App\Modules\Reporting\Enums\PeriodKind;
use Carbon\CarbonImmutable;

final readonly class ReportPeriod
{
    /**
     * @param  CarbonImmutable  $from  premier jour, inclus
     * @param  CarbonImmutable  $to  dernier jour, inclus (l'API l'expose tel quel ; la base garde la fin exclue)
     */
    public function __construct(
        public PeriodKind $kind,
        public CarbonImmutable $from,
        public CarbonImmutable $to,
    ) {}

    public function endExclusive(): CarbonImmutable
    {
        return $this->to->addDay();
    }

    /**
     * @return list<CarbonImmutable> premier jour de chaque mois touché
     */
    public function months(): array
    {
        $mois = [];

        for ($m = $this->from->startOfMonth(); $m->lessThanOrEqualTo($this->to); $m = $m->addMonth()) {
            $mois[] = $m;
        }

        return $mois;
    }
}

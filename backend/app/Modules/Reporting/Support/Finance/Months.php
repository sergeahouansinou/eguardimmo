<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Support\Finance;

use Carbon\CarbonImmutable;

final class Months
{
    /**
     * Mois civils `Y-m` de la fenêtre [from, toExclusive), du premier au dernier.
     *
     * @return list<string>
     */
    public static function between(CarbonImmutable $from, CarbonImmutable $toExclusive): array
    {
        $mois = [];

        for ($m = $from->startOfMonth(); $m->lessThan($toExclusive); $m = $m->addMonthNoOverflow()) {
            $mois[] = $m->format('Y-m');
        }

        return $mois;
    }
}

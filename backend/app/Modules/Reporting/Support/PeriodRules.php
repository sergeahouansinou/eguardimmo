<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Support;

use App\Modules\Reporting\Data\ReportPeriod;
use App\Modules\Reporting\Enums\ErrorCode;
use App\Modules\Reporting\Enums\PeriodKind;
use Carbon\CarbonImmutable;

final class PeriodRules
{
    /**
     * @param  string  $from  Y-m-d
     * @param  string  $to  Y-m-d, inclus
     */
    public function resolve(PeriodKind $kind, string $from, string $to, CarbonImmutable $today): ReportPeriod
    {
        $debut = CarbonImmutable::createFromFormat('!Y-m-d', $from);
        $fin = CarbonImmutable::createFromFormat('!Y-m-d', $to);

        if ($debut === null || $fin === null || $debut->toDateString() !== $from || $fin->toDateString() !== $to || $fin->lessThan($debut)) {
            throw ErrorCode::PeriodInvalid->problem('La période est mal formée : la fin précède le début.');
        }

        $attendue = match ($kind) {
            PeriodKind::Monthly => $debut->day === 1 ? $debut->endOfMonth()->startOfDay() : null,
            PeriodKind::Quarterly => $debut->day === 1 && in_array($debut->month, [1, 4, 7, 10], true) ? $debut->addMonths(3)->subDay() : null,
            PeriodKind::Custom => $fin->addDay()->lessThanOrEqualTo($debut->addMonths(12)) ? $fin : null,
        };

        if ($attendue === null || ! $attendue->equalTo($fin)) {
            throw ErrorCode::PeriodInvalid->problem(match ($kind) {
                PeriodKind::Monthly => 'Une période mensuelle couvre un mois civil entier.',
                PeriodKind::Quarterly => 'Une période trimestrielle couvre un trimestre civil entier.',
                PeriodKind::Custom => 'Une période personnalisée ne dépasse pas 12 mois.',
            });
        }

        if (! $fin->lessThan($today->startOfDay())) {
            throw ErrorCode::PeriodInvalid->problem('La période doit être terminée : sa dernière journée est passée.');
        }

        return new ReportPeriod($kind, $debut, $fin);
    }
}

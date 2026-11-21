<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Support\Finance;

use App\Modules\Reporting\Data\ForecastAssumptionsData;
use App\Modules\Reporting\Models\ForecastAssumption;

final class AssumptionsStore
{
    public function current(): ForecastAssumptionsData
    {
        $ligne = ForecastAssumption::query()->first();

        return $ligne === null ? ForecastAssumptionsData::empty() : self::data($ligne);
    }

    public static function data(ForecastAssumption $ligne): ForecastAssumptionsData
    {
        return new ForecastAssumptionsData(
            ForecastAssumptionsData::milli($ligne->indexation_rate),
            ForecastAssumptionsData::milli($ligne->expense_growth_rate),
            $ligne->vacancies,
            $ligne->one_off_expenses,
            $ligne->lock_version,
        );
    }
}

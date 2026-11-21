<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Support\Finance;

use App\Modules\Reporting\Data\ForecastAssumptionsData;

final class AssumptionsView
{
    /**
     * @return array<string, mixed>
     */
    public static function of(ForecastAssumptionsData $hypotheses, string $devise): array
    {
        return [
            'indexation_rate' => ForecastAssumptionsData::decimal($hypotheses->indexationMilli),
            'expense_growth_rate' => ForecastAssumptionsData::decimal($hypotheses->growthMilli),
            'vacancies' => $hypotheses->vacancies,
            'one_off_expenses' => array_map(fn (array $d): array => ['month' => $d['month'], 'label' => $d['label'], 'amount' => Amounts::view($d['amount'], $devise)], $hypotheses->oneOffExpenses),
            'lock_version' => $hypotheses->lockVersion,
            'official_index' => false,
        ];
    }
}

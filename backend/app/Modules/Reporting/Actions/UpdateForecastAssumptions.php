<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Actions;

use App\Modules\Properties\PublicApi\UnitDirectory;
use App\Modules\Reporting\Data\ForecastAssumptionsData;
use App\Modules\Reporting\Enums\ErrorCode;
use App\Modules\Reporting\Models\ForecastAssumption;
use App\Shared\Audit\RecordAudit;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

final readonly class UpdateForecastAssumptions
{
    public function __construct(private UnitDirectory $lots, private RecordAudit $audit) {}

    /**
     * Remplace les hypothèses de l'organisation courante ; verrou optimiste sur `lock_version` (0 tant que rien n'est enregistré). Un lot
     * hors de l'organisation lève `unit_not_found`.
     */
    public function handle(ForecastAssumptionsData $nouvelles): ForecastAssumptionsData
    {
        $this->lots->findMany(array_values(array_unique(array_column($nouvelles->vacancies, 'unit_id'))));

        try {
            return DB::transaction(fn (): ForecastAssumptionsData => $this->save($nouvelles));
        } catch (UniqueConstraintViolationException) {
            throw ErrorCode::ForecastAssumptionsStale->problem();
        }
    }

    private function save(ForecastAssumptionsData $nouvelles): ForecastAssumptionsData
    {
        $ligne = ForecastAssumption::query()->lockForUpdate()->first();
        $versionLue = $nouvelles->lockVersion;

        if (($ligne === null ? 0 : $ligne->lock_version) !== $versionLue) {
            throw ErrorCode::ForecastAssumptionsStale->problem();
        }

        $ligne ??= new ForecastAssumption;
        $ligne->forceFill([
            'indexation_rate' => ForecastAssumptionsData::decimal($nouvelles->indexationMilli),
            'expense_growth_rate' => ForecastAssumptionsData::decimal($nouvelles->growthMilli),
            'vacancies' => $nouvelles->vacancies,
            'one_off_expenses' => $nouvelles->oneOffExpenses,
            'lock_version' => $versionLue + 1,
        ])->save();
        $this->audit->handle('reporting.forecast.assumptions_updated', subject: $ligne);

        return new ForecastAssumptionsData($nouvelles->indexationMilli, $nouvelles->growthMilli, $nouvelles->vacancies, $nouvelles->oneOffExpenses, $versionLue + 1);
    }
}

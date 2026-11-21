<?php

declare(strict_types=1);

namespace App\Modules\Charges\Actions;

use App\Modules\Catalog\Enums\LeaseComponentSemantic;
use App\Modules\Charges\Enums\StatementStatus;
use App\Modules\Charges\Events\ChargeRegularizationDue;
use App\Modules\Charges\Models\ChargeDueFlag;
use App\Modules\Charges\Models\ChargeExercise;
use App\Modules\Charges\Models\ChargeStatement;
use App\Modules\Leases\Data\LeaseBillingData;
use App\Modules\Leases\Data\LeaseTermLineData;
use App\Modules\Leases\PublicApi\LeaseSchedule;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Un bail à provisions sans décompte émis pour une année terminée depuis plus de `charges.due_after_months` : une alerte par (bail, année), rejouable.
 * La fenêtre remonte de trois ans : un balayage manqué est rattrapé, un ancien exercice ne revient pas.
 */
final readonly class FlagDueRegularizations
{
    private const int ANNEES = 3;

    private const int LOT = 200;

    public function __construct(
        private CurrentOrganization $contexte,
        private LeaseSchedule $baux,
    ) {}

    public function handle(CarbonImmutable $today): int
    {
        $derniere = $today->subMonths(max(0, (int) config('charges.due_after_months')))->year - 1;
        $emises = 0;

        for ($annee = $derniere - self::ANNEES + 1; $annee <= $derniere; $annee++) {
            $debut = CarbonImmutable::parse(sprintf('%04d-01-01', $annee));
            $fin = CarbonImmutable::parse(sprintf('%04d-12-31', $annee));

            foreach ($this->baux->organizationsWithActiveLeases($debut, $fin) as $organisation) {
                $emises += (int) $this->contexte->run($organisation, fn (): int => $this->year($organisation, $annee, $debut, $fin));
            }
        }

        return $emises;
    }

    private function year(string $organisation, int $annee, CarbonImmutable $debut, CarbonImmutable $fin): int
    {
        $emises = 0;
        $apres = null;

        do {
            $baux = $this->baux->activeBetween($debut, $fin, $apres, self::LOT);
            $ids = array_map(fn (LeaseBillingData $b): string => $b->leaseId, $baux);
            $apres = $ids === [] ? null : $ids[array_key_last($ids)];

            foreach ($this->missing($ids, $annee, $debut, $fin) as $bail) {
                $emises += $this->flag($organisation, $bail, $annee) ? 1 : 0;
            }
        } while (count($baux) === self::LOT);

        return $emises;
    }

    /**
     * @param  list<string>  $ids
     * @return list<string>
     */
    private function missing(array $ids, int $annee, CarbonImmutable $debut, CarbonImmutable $fin): array
    {
        if ($ids === []) {
            return [];
        }

        $lignes = $this->baux->linesBetweenMany($ids, $debut, $fin);
        $aProvisions = array_values(array_filter($ids, fn (string $id): bool => array_filter($lignes[$id] ?? [], fn (LeaseTermLineData $l): bool => $l->semantic === LeaseComponentSemantic::ChargesProvision) !== []));

        if ($aProvisions === []) {
            return [];
        }

        $couverts = ChargeStatement::query()
            ->whereIn('lease_id', $aProvisions)
            ->whereIn('status', [StatementStatus::Issued->value, StatementStatus::Superseded->value])
            ->whereIn('exercise_id', ChargeExercise::query()->where('period_start', '<=', $fin->toDateString())->where('period_end', '>', $debut->toDateString())->select('id'))
            ->pluck('lease_id')->all();

        return array_values(array_diff($aProvisions, $couverts));
    }

    private function flag(string $organisation, string $bail, int $annee): bool
    {
        return DB::transaction(function () use ($organisation, $bail, $annee): bool {
            $drapeau = ChargeDueFlag::query()->firstOrCreate(['lease_id' => $bail, 'year' => $annee]);

            if (! $drapeau->wasRecentlyCreated) {
                return false;
            }

            ChargeRegularizationDue::dispatch($bail, $organisation, $annee);

            return true;
        });
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Charges\Support;

use App\Modules\Catalog\Enums\LeaseComponentSemantic;
use App\Modules\Charges\Data\ComputeInputs;
use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Jurisdictions\ChargeRules;
use App\Modules\Charges\Models\ChargeExercise;
use App\Modules\Leases\Data\LeaseTermLineData;
use App\Modules\Leases\Data\OccupiedPeriodData;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Leases\PublicApi\LeaseSchedule;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Properties\Data\UnitData;
use App\Modules\Properties\PublicApi\UnitDirectory;
use App\Modules\Rent\Data\LeaseProvisionsData;
use App\Modules\Rent\PublicApi\ChargeProvisions;
use Carbon\CarbonImmutable;

/**
 * Lectures du calcul : un nombre de requêtes qui ne dépend pas du nombre de baux (lecture par lots de chaque PublicApi).
 */
final readonly class ComputeLoader
{
    public function __construct(
        private UnitDirectory $lots,
        private LeaseDirectory $baux,
        private LeaseSchedule $echeanciers,
        private ChargeProvisions $provisions,
        private MandateDirectory $mandats,
    ) {}

    public function load(ChargeExercise $exercice, ChargeRules $regles): ComputeInputs
    {
        $debut = CarbonImmutable::parse($exercice->period_start)->startOfDay();
        $fin = CarbonImmutable::parse($exercice->period_end)->startOfDay();
        $lotIds = array_map(fn (UnitData $l): string => $l->id, $this->lots->ofProperty($exercice->property_id));
        $occupations = array_values(array_filter(
            $this->baux->occupiedBetween($lotIds, $debut, $fin),
            fn (OccupiedPeriodData $o): bool => $exercice->only_lease_id === null || $o->leaseId === $exercice->only_lease_id,
        ));
        $candidats = array_values(array_unique(array_map(fn (OccupiedPeriodData $o): string => $o->leaseId, $occupations)));
        [$concernes, $ecartes] = $this->partition($candidats, $debut, $fin);
        $this->assertRegimes($concernes, $regles);

        $parBail = [];
        $intervalles = [];
        foreach ($occupations as $o) {
            if (! in_array($o->leaseId, $concernes, true)) {
                continue;
            }
            $jusqua = $o->to ?? $fin->toDateString();
            $jours = max(0, (int) CarbonImmutable::parse($o->from)->diffInDays(CarbonImmutable::parse($jusqua)));
            $parBail[$o->leaseId][$o->unitId] = ($parBail[$o->leaseId][$o->unitId] ?? 0) + $jours;
            $intervalles[$o->leaseId][] = [$o->from, $jusqua];
        }

        $provisions = $concernes === [] ? [] : $this->provisions->calledBetween($concernes, $debut, $fin);

        return new ComputeInputs(
            $debut, $fin, (int) $debut->diffInDays($fin), $parBail,
            array_map(fn (array $liste): int => $this->unionDays($liste), $intervalles),
            $provisions, $this->mandants($concernes, $parBail, $provisions),
            array_values(array_unique(array_merge(...array_map(fn (array $l): array => array_keys($l), array_values($parBail) ?: [[]])))),
            $ecartes,
        );
    }

    /**
     * @param  list<string>  $candidats
     * @return array{0: list<string>, 1: list<array{lease_id: string, reason: string}>}
     */
    private function partition(array $candidats, CarbonImmutable $debut, CarbonImmutable $fin): array
    {
        if ($candidats === []) {
            return [[], []];
        }

        $lignes = $this->echeanciers->linesBetweenMany($candidats, $debut, $fin->subDay());
        $concernes = [];
        $ecartes = [];

        foreach ($candidats as $bail) {
            $semantiques = array_map(fn (LeaseTermLineData $l): ?LeaseComponentSemantic => $l->semantic, $lignes[$bail] ?? []);

            if (in_array(LeaseComponentSemantic::ChargesProvision, $semantiques, true)) {
                $concernes[] = $bail;
            } else {
                $ecartes[] = ['lease_id' => $bail, 'reason' => in_array(LeaseComponentSemantic::ChargesFlat, $semantiques, true) ? 'flat_rate' : 'no_provision'];
            }
        }

        return [$concernes, $ecartes];
    }

    /**
     * @param  list<string>  $concernes
     */
    private function assertRegimes(array $concernes, ChargeRules $regles): void
    {
        if ($concernes === []) {
            return;
        }

        foreach ($this->baux->findMany($concernes) as $bail) {
            if (! $regles->admitsRegime($bail->regimeKey)) {
                throw ErrorCode::RegimeUnsupported->problem(sprintf('Le bail %s relève d\'un régime que la régularisation ne couvre pas.', $bail->reference));
            }
        }
    }

    /**
     * @param  list<array{0: string, 1: string}>  $liste
     */
    private function unionDays(array $liste): int
    {
        usort($liste, fn (array $a, array $b): int => strcmp($a[0], $b[0]));
        $total = 0;
        $courant = null;

        foreach ($liste as [$de, $a]) {
            if ($courant === null || $de > $courant[1]) {
                $total += $courant === null ? 0 : $this->days($courant[0], $courant[1]);
                $courant = [$de, $a];
            } elseif ($a > $courant[1]) {
                $courant[1] = $a;
            }
        }

        return $total + ($courant === null ? 0 : $this->days($courant[0], $courant[1]));
    }

    private function days(string $de, string $a): int
    {
        return max(0, (int) CarbonImmutable::parse($de)->diffInDays(CarbonImmutable::parse($a)));
    }

    /**
     * Un bail sur un lot sous mandat, ou dont des provisions ont été routées vers un mandant, demande un mandant unique et des appels tous routés.
     *
     * @param  list<string>  $concernes
     * @param  array<string, array<string, int>>  $parBail
     * @param  array<string, LeaseProvisionsData>  $provisions
     * @return array<string, array{mandate: string|null, mandant: string|null}>
     */
    private function mandants(array $concernes, array $parBail, array $provisions): array
    {
        $lots = array_values(array_unique(array_merge(...array_map(fn (array $l): array => array_keys($l), array_values($parBail) ?: [[]]))));
        $couverts = $lots === [] ? [] : $this->mandats->coveringUnits($lots, CarbonImmutable::today());
        $resultat = [];

        foreach ($concernes as $bail) {
            $mandants = isset($provisions[$bail]) ? $provisions[$bail]->mandantPartyIds : [];
            $sousMandat = $mandants !== [] || array_intersect(array_keys($parBail[$bail] ?? []), array_keys($couverts)) !== [];

            if (! $sousMandat) {
                $resultat[$bail] = ['mandate' => null, 'mandant' => null];

                continue;
            }

            if (count($mandants) !== 1 || $provisions[$bail]->hasUnrouted) {
                throw ErrorCode::OwnerFundsNotReady->problem('Les provisions de ce bail n\'ont pas toutes été routées vers un mandant unique : la régularisation ne peut pas être calculée.');
            }

            $resultat[$bail] = ['mandate' => $provisions[$bail]->mandateIds[0] ?? null, 'mandant' => $mandants[0]];
        }

        return $resultat;
    }
}

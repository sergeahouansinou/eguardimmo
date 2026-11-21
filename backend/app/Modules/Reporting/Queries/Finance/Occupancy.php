<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Queries\Finance;

use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Properties\PublicApi\UnitDirectory;
use App\Modules\Reporting\Enums\ErrorCode;
use App\Modules\Reporting\Support\Finance\Amounts;
use App\Modules\Reporting\Support\Finance\Months;
use App\Modules\Reporting\Support\Reading;
use Carbon\CarbonImmutable;

/**
 * Occupation par lot et par mois : `occupied`, `notice` (préavis reçu avant la fin du mois) ou `vacant`, à partir des occupations par des baux
 * signés. Un mois est vacant s'il n'a aucun jour occupé ; `occupied_days` laisse nuancer un mois partiel. L'état `T` (travaux) est reporté.
 */
final readonly class Occupancy
{
    public const int UNITS_MAX = 500;

    public function __construct(private Reading $lecture, private LeaseDirectory $baux, private UnitDirectory $lots) {}

    /**
     * @return array<string, mixed>
     */
    public function between(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $fin = $to->addDay();
        $ids = array_values(array_map(strval(...), $this->lecture->table('units')->whereNull('archived_at')->orderBy('id')->limit(self::UNITS_MAX + 1)->pluck('id')->all()));

        if (count($ids) > self::UNITS_MAX) {
            throw ErrorCode::FinanceTooLarge->problem();
        }

        $periodes = $this->baux->occupiedBetween($ids, $from, $fin);
        $preavis = $this->noticeDates(array_values(array_unique(array_map(fn ($p): string => $p->leaseId, $periodes))));
        $parLot = [];

        foreach ($periodes as $p) {
            $parLot[$p->unitId][] = [$p->from, $p->to ?? $fin->toDateString(), $preavis[$p->leaseId] ?? null];
        }

        $mois = Months::between($from, $fin);
        $noms = $this->names($ids);
        $unites = [];
        $synthese = array_fill_keys($mois, ['occupied' => 0, 'notice' => 0, 'vacant' => 0, 'occupied_days' => 0, 'days' => 0]);

        foreach ($ids as $id) {
            $ligne = [];

            foreach ($mois as $m) {
                $etat = $this->month($parLot[$id] ?? [], CarbonImmutable::createFromFormat('!Y-m', $m) ?? $from, $from, $fin);
                $ligne[] = ['month' => $m, ...$etat];
                $synthese[$m][$etat['state']]++;
                $synthese[$m]['occupied_days'] += $etat['occupied_days'];
                $synthese[$m]['days'] += $etat['days'];
            }

            $unites[] = ['unit_id' => $id, 'unit_reference' => $noms[$id]['reference'] ?? null, 'property_name' => $noms[$id]['property'] ?? null, 'months' => $ligne];
        }

        return [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'months' => $mois,
            'units' => $unites,
            'summary' => array_map(fn (string $m, array $s): array => [
                'month' => $m,
                'occupied' => $s['occupied'],
                'notice' => $s['notice'],
                'vacant' => $s['vacant'],
                'occupancy_rate_bp' => $s['days'] === 0 ? null : Amounts::basisPoints($s['occupied_days'], $s['days']),
            ], array_keys($synthese), $synthese),
        ];
    }

    /**
     * @param  list<array{string, string, ?string}>  $occupations  début, fin exclue, réception du préavis
     * @return array{state: string, occupied_days: int, days: int}
     */
    private function month(array $occupations, CarbonImmutable $debut, CarbonImmutable $from, CarbonImmutable $fin): array
    {
        $a = max($debut->toDateString(), $from->toDateString());
        $b = min($debut->addMonthNoOverflow()->toDateString(), $fin->toDateString());
        $jours = $this->index($b) - $this->index($a);
        $dernier = $debut->endOfMonth()->toDateString();
        $couverts = [];
        $preavis = false;

        foreach ($occupations as [$debutOccupation, $finOccupation, $recuLe]) {
            $x = max($a, $debutOccupation);
            $y = min($b, $finOccupation);

            if ($x >= $y) {
                continue;
            }

            for ($j = $this->index($x); $j < $this->index($y); $j++) {
                $couverts[$j] = true;
            }

            $preavis = $preavis || ($recuLe !== null && $recuLe <= $dernier);
        }

        $occupes = count($couverts);

        return ['state' => $occupes === 0 ? 'vacant' : ($preavis ? 'notice' : 'occupied'), 'occupied_days' => $occupes, 'days' => $jours];
    }

    private function index(string $jour): int
    {
        return intdiv((int) strtotime($jour.' UTC'), 86400);
    }

    /**
     * @param  list<string>  $leaseIds
     * @return array<string, string> réception du préavis par bail
     */
    private function noticeDates(array $leaseIds): array
    {
        $dates = [];

        foreach ($this->baux->findMany($leaseIds) as $bail) {
            if ($bail->noticeReceivedOn !== null) {
                $dates[$bail->id] = $bail->noticeReceivedOn;
            }
        }

        return $dates;
    }

    /**
     * @param  list<string>  $ids
     * @return array<string, array{reference: string, property: string}>
     */
    private function names(array $ids): array
    {
        $noms = [];

        foreach ($this->lots->findMany($ids) as $id => $lot) {
            $noms[$id] = ['reference' => $lot->reference, 'property' => $lot->propertyName];
        }

        return $noms;
    }
}

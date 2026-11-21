<?php

declare(strict_types=1);

namespace App\Modules\Tax\Support\Facts;

use App\Modules\Leases\Data\LeaseData;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Leases\PublicApi\LeaseSchedule;
use App\Modules\Properties\Data\UnitData;
use App\Modules\Properties\PublicApi\UnitDirectory;
use App\Modules\Tax\Jurisdictions\RentalIncomeRules;

/**
 * Les baux de l'année (en cours sur l'année, ou qui ont encaissé) triés selon le formulaire : location nue retenue, autres régimes
 * écartés avec avertissement. Le bien d'un encaissement se lit sur son lot, à défaut sur le lot principal du bail.
 */
final class LeaseUniverse
{
    /** @var array<string, LeaseData> */
    public array $included = [];

    /** @var array<string, true> */
    public array $excluded = [];

    /** @var array<string, true> */
    public array $active = [];

    /** @var array<string, UnitData> */
    public array $units = [];

    public function __construct(private readonly LeaseSchedule $planning, private readonly LeaseDirectory $baux, private readonly UnitDirectory $lots) {}

    /**
     * @param  list<string>  $extraLeaseIds  baux vus dans le grand livre
     */
    public function load(YearWindow $annee, RentalIncomeRules $regles, array $extraLeaseIds): self
    {
        $actifs = [];
        $apres = null;

        do {
            $page = $this->planning->activeBetween($annee->from, $annee->last, $apres, 500);

            foreach ($page as $bail) {
                $actifs[$bail->leaseId] = true;
            }

            $apres = $page === [] ? null : $page[array_key_last($page)]->leaseId;
        } while (count($page) === 500);

        $this->active = $actifs;
        $ids = array_values(array_unique([...array_keys($actifs), ...$extraLeaseIds]));
        $lotIds = [];

        foreach (array_chunk($ids, 200) as $lot) {
            foreach ($this->baux->findMany($lot) as $bail) {
                if (! $regles->admitsLeaseRegime($bail->regimeKey)) {
                    $this->excluded[$bail->id] = true;

                    continue;
                }

                $this->included[$bail->id] = $bail;

                foreach ($bail->units as $lien) {
                    $lotIds[$lien->unitId] = $lien->unitId;
                }
            }
        }

        $this->units = $this->lots->findMany(array_values($lotIds));

        return $this;
    }

    public function propertyOf(string $leaseId, ?string $unitId): ?string
    {
        if ($unitId !== null && isset($this->units[$unitId])) {
            return $this->units[$unitId]->propertyId;
        }

        $principal = $this->mainUnit($leaseId);

        return $principal === null ? null : $this->units[$principal]->propertyId;
    }

    public function mainUnit(string $leaseId): ?string
    {
        foreach ($this->included[$leaseId]->units ?? [] as $lien) {
            if ($lien->isMain && isset($this->units[$lien->unitId])) {
                return $lien->unitId;
            }
        }

        return null;
    }

    /**
     * Lots principaux loués dans l'année, par bien : l'annexe louée avec le lot principal ne compte pas (ADR 0039).
     *
     * @return array<string, list<string>>
     */
    public function rentedMainUnits(YearWindow $annee): array
    {
        $parBien = [];

        foreach (array_keys($this->active) as $leaseId) {
            foreach ($this->included[$leaseId]->units ?? [] as $lien) {
                $fin = $lien->validTo;

                if (! $lien->isMain || ! isset($this->units[$lien->unitId]) || $lien->validFrom >= $annee->toExclusive->toDateString() || ($fin !== null && $fin <= $annee->from->toDateString())) {
                    continue;
                }

                $parBien[$this->units[$lien->unitId]->propertyId][$lien->unitId] = $lien->unitId;
            }
        }

        return array_map(fn (array $lots): array => array_values($lots), $parBien);
    }

    /**
     * @return array<string, string> nom par bien
     */
    public function propertyNames(): array
    {
        $noms = [];

        foreach ($this->units as $lot) {
            $noms[$lot->propertyId] = $lot->propertyName;
        }

        return $noms;
    }
}

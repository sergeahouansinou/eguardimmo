<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Catalog\Data\TermData;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Leases\Models\LeaseTerm;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Leases\Support\LeasePhaseResolver;
use App\Modules\Leases\Support\LeaseView;
use App\Modules\Parties\Data\PartyData;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Modules\Properties\Data\UnitData;
use App\Modules\Properties\PublicApi\UnitDirectory;
use Carbon\CarbonInterface;
use Closure;

/**
 * Résout lots, parties et composantes d'une série de baux déjà chargés, une fois chacun.
 */
final readonly class LeaseViews
{
    public function __construct(
        private LeasePhaseResolver $phases,
        private UnitDirectory $lots,
        private PartyDirectory $parties,
        private TermDirectory $termes,
    ) {}

    /**
     * @param  iterable<Lease>  $baux  relations `units`, `parties` et `terms` chargées
     * @return list<LeaseView>
     */
    public function of(iterable $baux, CarbonInterface $today, ?CarbonInterface $termsDay = null): array
    {
        return $this->at(array_values([...$baux]), fn (): CarbonInterface => $today, fn (): ?CarbonInterface => $termsDay);
    }

    /**
     * Comme `of()`, avec un jour de référence par bail.
     *
     * @param  list<Lease>  $baux  relations `units`, `parties` et `terms` chargées
     * @param  Closure(Lease): CarbonInterface  $today
     * @param  Closure(Lease): ?CarbonInterface  $termsDay
     * @return list<LeaseView>
     */
    public function at(array $baux, Closure $today, Closure $termsDay): array
    {

        $lots = $this->unitData(array_merge(...array_map(fn (Lease $b): array => array_map(fn (LeaseUnit $u): string => $u->unit_id, $this->units($b)), $baux)));
        $parties = $this->partyData(array_merge(...array_map(fn (Lease $b): array => array_map(fn (LeaseParty $p): string => $p->party_id, $this->parties($b)), $baux)));
        $composantes = $this->components(array_merge(...array_map(fn (Lease $b): array => array_map(fn (LeaseTerm $t): string => $t->component_term_id, $this->terms($b)), $baux)));

        return array_map(fn (Lease $bail): LeaseView => new LeaseView(
            lease: $bail,
            phase: $this->phases->at($bail, $today($bail)),
            today: $today($bail),
            units: $this->units($bail),
            parties: $this->parties($bail),
            terms: $this->terms($bail),
            unitData: $lots,
            partyData: $parties,
            components: $composantes,
            termsDay: $termsDay($bail),
        ), $baux);
    }

    /**
     * @param  list<string>  $ids
     * @return array<string, UnitData>
     */
    public function unitData(array $ids): array
    {
        return $this->lots->findMany(array_values(array_unique($ids)));
    }

    /**
     * @param  list<string>  $ids
     * @return array<string, PartyData>
     */
    public function partyData(array $ids): array
    {
        return $this->parties->findMany(array_values(array_unique($ids)));
    }

    /**
     * @param  list<string>  $ids
     * @return array<string, TermData>
     */
    public function components(array $ids): array
    {
        return $this->termes->findMany(array_values(array_unique($ids)), VocabularyKey::LeaseComponent);
    }

    /**
     * @return list<LeaseUnit>
     */
    private function units(Lease $bail): array
    {
        return $bail->relationLoaded('units') ? array_values($bail->units->all()) : [];
    }

    /**
     * @return list<LeaseParty>
     */
    private function parties(Lease $bail): array
    {
        return $bail->relationLoaded('parties') ? array_values($bail->parties->all()) : [];
    }

    /**
     * @return list<LeaseTerm>
     */
    private function terms(Lease $bail): array
    {
        return $bail->relationLoaded('terms') ? array_values($bail->terms->all()) : [];
    }
}

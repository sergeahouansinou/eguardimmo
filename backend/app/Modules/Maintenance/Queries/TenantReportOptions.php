<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Queries;

use App\Modules\Catalog\Data\TermData;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Leases\Data\LeaseData;
use App\Modules\Leases\Data\LeaseUnitData;
use App\Modules\Leases\Data\TenantLeaseKeyData;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Maintenance\Data\ReportOptionData;
use App\Modules\Properties\PublicApi\UnitDirectory;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;

/**
 * Choix du formulaire de signalement : les baux que Leases rend visibles au locataire, restreints à ceux sur lesquels il peut
 * encore signaler (même règle que la création). Les natures sont celles de l'organisation de chaque bail, lues une fois par organisation.
 */
final readonly class TenantReportOptions
{
    public function __construct(
        private CurrentOrganization $contexte,
        private LeaseDirectory $baux,
        private UnitDirectory $lots,
        private TermDirectory $termes,
    ) {}

    /**
     * @param  list<TenantLeaseKeyData>  $cles
     * @return list<ReportOptionData>
     */
    public function build(array $cles, CarbonImmutable $today): array
    {
        $parOrganisation = [];

        foreach ($cles as $cle) {
            $parOrganisation[$cle->organizationId][] = $cle->leaseId;
        }

        $options = [];

        foreach ($parOrganisation as $organisation => $ids) {
            $options = [...$options, ...$this->contexte->run((string) $organisation, fn (): array => $this->forOrganization($ids, $today))];
        }

        usort($options, fn (ReportOptionData $a, ReportOptionData $b): int => [$a->label, $a->leaseId] <=> [$b->label, $b->leaseId]);

        return $options;
    }

    /**
     * @param  list<string>  $leaseIds
     * @return list<ReportOptionData>
     */
    private function forOrganization(array $leaseIds, CarbonImmutable $today): array
    {
        $jour = $today->toDateString();
        $actifs = array_values(array_filter(
            $this->baux->findMany($leaseIds),
            fn (LeaseData $bail): bool => $bail->status === LeaseStatus::Signed && ($bail->endsOn === null || $bail->endsOn > $jour),
        ));

        if ($actifs === []) {
            return [];
        }

        $occupes = [];
        $lotIds = [];

        foreach ($actifs as $bail) {
            $occupes[$bail->id] = array_values(array_filter($bail->units, fn (LeaseUnitData $ligne): bool => $ligne->validFrom <= $jour && ($ligne->validTo === null || $ligne->validTo > $jour)));

            foreach ($occupes[$bail->id] as $ligne) {
                $lotIds[$ligne->unitId] = true;
            }
        }

        $lots = $lotIds === [] ? [] : $this->lots->findMany(array_keys($lotIds));
        $natures = array_map(fn (TermData $terme): array => ['id' => $terme->id, 'key' => $terme->key, 'label' => $terme->label()], $this->termes->list(VocabularyKey::InterventionNature));

        return array_map(fn (LeaseData $bail): ReportOptionData => new ReportOptionData(
            $bail->id,
            $bail->reference,
            array_map(fn (LeaseUnitData $ligne): array => ['id' => $ligne->unitId, 'label' => $lots[$ligne->unitId]->propertyName.' - '.$lots[$ligne->unitId]->reference], $occupes[$bail->id]),
            $occupes[$bail->id] !== [],
            $natures,
        ), $actifs);
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Queries;

use App\Modules\Mandates\Data\OwnerCoverageData;
use App\Modules\Mandates\Data\OwnerVisibleData;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Models\MandateUnit;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\JoinClause;

/**
 * Lots couverts par les mandats des couples (organisation, mandant) lisibles : une seule requête, quel que soit leur nombre.
 * Un lot couvert deux fois (renouvellement) donne une ligne par mandat ; un brouillon et un mandat archivé ne couvrent rien.
 */
final readonly class OwnerCoverage
{
    /**
     * @param  list<OwnerVisibleData>  $visibles
     * @return list<OwnerCoverageData>
     */
    public function of(array $visibles): array
    {
        if ($visibles === []) {
            return [];
        }

        $parOrganisation = [];

        foreach ($visibles as $visible) {
            $parOrganisation[$visible->organizationId][] = $visible->mandantPartyId;
        }

        $lignes = AcrossOrganizations::query(MandateUnit::class)
            ->select(['mandate_units.organization_id', 'mandate_units.mandate_id', 'mandate_units.unit_id', 'mandate_units.valid_from', 'mandate_units.valid_to'])
            ->addSelect(['mandates.mandant_party_id as mandant_party_id', 'mandates.starts_on as mandate_starts_on', 'mandates.ends_on as mandate_ends_on'])
            ->join('mandates', fn (JoinClause $j) => $j->on('mandates.id', '=', 'mandate_units.mandate_id')->on('mandates.organization_id', '=', 'mandate_units.organization_id'))
            ->whereNull('mandates.archived_at')
            ->where('mandates.status', '<>', MandateStatus::Draft->value)
            ->where(function (Builder $groupe) use ($parOrganisation): void {
                foreach ($parOrganisation as $organisationId => $mandants) {
                    $groupe->orWhere(fn (Builder $paire) => $paire
                        ->where('mandates.organization_id', $organisationId)
                        ->whereIn('mandates.mandant_party_id', array_values(array_unique($mandants))));
                }
            })
            ->orderBy('mandates.organization_id')->orderBy('mandate_units.unit_id')->orderBy('mandate_units.valid_from')->orderBy('mandate_units.id')
            ->get();

        $couvertures = [];

        foreach ($lignes as $ligne) {
            $debut = max($this->day($ligne->getAttribute('mandate_starts_on')), $this->day($ligne->getAttribute('valid_from')));
            $fins = [$this->last($ligne->getAttribute('mandate_ends_on'))];

            if ($ligne->getAttribute('valid_to') !== null) {
                $fins[] = $this->last($ligne->getAttribute('valid_to'));
            }

            $fin = min($fins);

            if ($fin < $debut) {
                continue;
            }

            $couvertures[] = new OwnerCoverageData(
                organizationId: $ligne->organization_id,
                mandantPartyId: (string) $ligne->getAttribute('mandant_party_id'),
                mandateId: $ligne->mandate_id,
                unitId: $ligne->unit_id,
                from: $debut,
                to: $fin,
            );
        }

        return $couvertures;
    }

    private function day(mixed $valeur): string
    {
        return substr((string) $valeur, 0, 10);
    }

    private function last(mixed $finExclue): string
    {
        return CarbonImmutable::parse($this->day($finExclue))->subDay()->toDateString();
    }
}

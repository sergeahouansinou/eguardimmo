<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Catalog\Enums\LeaseComponentSemantic;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Leases\Data\LeaseTermLineData;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Models\LeaseTerm;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

final readonly class ScheduleLines
{
    public function __construct(
        private LeaseSummaries $resumes,
        private TermDirectory $termes,
    ) {}

    /**
     * Lignes dont la période [valid_from, valid_to) recoupe l'intervalle $from..$to, bornes comprises.
     *
     * @return list<LeaseTermLineData>
     */
    public function between(string $leaseId, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $bail = $this->resumes->bail($leaseId);

        if ($to->lessThan($from)) {
            throw ErrorCode::LeasePeriodInvalid->problem();
        }

        $lignes = LeaseTerm::query()
            ->where('lease_id', $bail->id)
            ->where('valid_from', '<=', $to->toDateString())
            ->where(fn (Builder $q) => $q->whereNull('valid_to')->orWhere('valid_to', '>', $from->toDateString()))
            ->orderBy('valid_from')
            ->orderBy('id')
            ->get();

        $composantes = [];

        return array_values($lignes->map(function (LeaseTerm $ligne) use (&$composantes): LeaseTermLineData {
            $composante = $composantes[$ligne->component_term_id] ??= $this->termes->find($ligne->component_term_id, VocabularyKey::LeaseComponent);

            return new LeaseTermLineData(
                id: $ligne->id,
                leaseId: $ligne->lease_id,
                componentTermId: $composante->id,
                componentKey: $composante->key,
                semantic: $composante->semanticKey === null ? null : LeaseComponentSemantic::tryFrom($composante->semanticKey),
                amount: $ligne->amount,
                vatBp: $ligne->vat_bp,
                indexed: $ligne->indexed,
                validFrom: $ligne->valid_from->toDateString(),
                validTo: $ligne->valid_to?->toDateString(),
            );
        })->all());
    }

    /**
     * Même lecture que `between` pour plusieurs baux de l'organisation courante, en un nombre constant de requêtes ; un bail inconnu est absent du résultat.
     *
     * @param  list<string>  $leaseIds
     * @return array<string, list<LeaseTermLineData>> par identifiant de bail, les lignes de chaque bail triées comme `between`
     */
    public function betweenMany(array $leaseIds, CarbonImmutable $from, CarbonImmutable $to): array
    {
        if ($to->lessThan($from)) {
            throw ErrorCode::LeasePeriodInvalid->problem();
        }

        $ids = array_values(array_unique($leaseIds));

        if ($ids === []) {
            return [];
        }

        $lignes = LeaseTerm::query()
            ->whereIn('lease_id', $ids)
            ->where('valid_from', '<=', $to->toDateString())
            ->where(fn (Builder $q) => $q->whereNull('valid_to')->orWhere('valid_to', '>', $from->toDateString()))
            ->orderBy('valid_from')
            ->orderBy('id')
            ->get();

        $composantes = $this->termes->findMany(array_values(array_unique(array_map(fn (LeaseTerm $l): string => $l->component_term_id, $lignes->all()))), VocabularyKey::LeaseComponent);
        $resultat = [];

        foreach ($lignes as $ligne) {
            $composante = $composantes[$ligne->component_term_id];
            $resultat[$ligne->lease_id][] = new LeaseTermLineData(
                id: $ligne->id,
                leaseId: $ligne->lease_id,
                componentTermId: $composante->id,
                componentKey: $composante->key,
                semantic: $composante->semanticKey === null ? null : LeaseComponentSemantic::tryFrom($composante->semanticKey),
                amount: $ligne->amount,
                vatBp: $ligne->vat_bp,
                indexed: $ligne->indexed,
                validFrom: $ligne->valid_from->toDateString(),
                validTo: $ligne->valid_to?->toDateString(),
            );
        }

        return $resultat;
    }
}

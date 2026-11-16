<?php

declare(strict_types=1);

namespace App\Modules\Parties\Queries;

use App\Modules\Catalog\Enums\ContactCategorySemantic;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Parties\Data\PartyData;
use App\Modules\Parties\Enums\ErrorCode;
use App\Modules\Parties\Models\ContactPoint;
use App\Modules\Parties\Models\Party;
use App\Modules\Parties\Models\PartyContactCategory;

final readonly class PartySummaries
{
    public function __construct(
        private Parties $parties,
        private TermDirectory $termes,
    ) {}

    public function one(string $id): PartyData
    {
        $partie = $this->parties->get($id);

        return $this->toData([$partie])[0];
    }

    /**
     * @param  list<string>  $ids
     * @return array<string, PartyData> par identifiant
     */
    public function many(array $ids): array
    {
        $ids = array_values(array_unique($ids));

        if ($ids === []) {
            return [];
        }

        $parties = $this->parties->getMany($ids);
        $donnees = [];

        foreach ($this->toData(array_map(fn (string $id): Party => $parties[$id] ?? throw ErrorCode::PartyNotFound->problem(), $ids)) as $donnee) {
            $donnees[$donnee->id] = $donnee;
        }

        return $donnees;
    }

    /**
     * Parties actives (ni archivées ni anonymisées) qui portent une catégorie de ce sens, par nom.
     *
     * @return list<PartyData>
     */
    public function withCategory(ContactCategorySemantic $sens): array
    {
        $termIds = array_map(
            fn ($terme): string => $terme->id,
            $this->termes->bySemanticKey(VocabularyKey::ContactCategory, $sens->value),
        );

        if ($termIds === []) {
            return [];
        }

        $parties = Party::query()
            ->whereNull('archived_at')
            ->whereNull('anonymized_at')
            ->whereHas('categories', fn ($q) => $q->whereIn('contact_category_term_id', $termIds))
            ->orderBy('display_name')
            ->orderBy('id')
            ->get();

        return $this->toData(array_values($parties->all()));
    }

    /**
     * @param  list<Party>  $parties
     * @return list<PartyData>
     */
    private function toData(array $parties): array
    {
        $ids = array_map(fn (Party $partie): string => $partie->id, $parties);

        $emails = ContactPoint::query()->whereIn('party_id', $ids)->where('type', 'email')->where('is_primary', true)->get()->keyBy('party_id');
        $categories = PartyContactCategory::query()->whereIn('party_id', $ids)->get()->groupBy('party_id');
        $sens = [];

        return array_map(function (Party $partie) use ($emails, $categories, &$sens): PartyData {
            $semantiques = [];

            foreach ($categories->get($partie->id, []) as $ligne) {
                $sens[$ligne->contact_category_term_id] ??= $this->termes->find($ligne->contact_category_term_id, VocabularyKey::ContactCategory)->semanticKey;

                if ($sens[$ligne->contact_category_term_id] !== null) {
                    $semantiques[] = $sens[$ligne->contact_category_term_id];
                }
            }

            return new PartyData(
                id: $partie->id,
                displayName: $partie->display_name,
                kind: $partie->kind,
                primaryEmail: $partie->isAnonymized() ? null : $emails->get($partie->id)?->value,
                categories: array_values(array_unique($semantiques)),
                isAnonymized: $partie->isAnonymized(),
            );
        }, $parties);
    }
}

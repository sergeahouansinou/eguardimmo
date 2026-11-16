<?php

declare(strict_types=1);

namespace App\Modules\Properties\Queries;

use App\Modules\Catalog\Enums\UnitTypeSemantic;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Properties\Data\UnitData;
use App\Modules\Properties\Enums\ErrorCode;
use App\Modules\Properties\Models\Unit;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Str;

final readonly class UnitSummaries
{
    public function __construct(
        private Units $units,
        private TermDirectory $termes,
    ) {}

    public function one(string $id): UnitData
    {
        return $this->toData([$this->units->get($id)])[0];
    }

    /**
     * @param  list<string>  $ids
     * @return array<string, UnitData> par identifiant
     */
    public function many(array $ids): array
    {
        $ids = array_values(array_unique($ids));

        if ($ids === []) {
            return [];
        }

        if (array_filter($ids, fn (string $id): bool => ! Str::isUuid($id)) !== []) {
            throw ErrorCode::UnitNotFound->problem();
        }

        $unites = Unit::query()->with('property')->whereIn('id', $ids)->get()->keyBy('id');

        $resultat = [];

        foreach ($this->toData(array_map(fn (string $id): Unit => $unites->get($id) ?? throw ErrorCode::UnitNotFound->problem(), $ids)) as $donnee) {
            $resultat[$donnee->id] = $donnee;
        }

        return $resultat;
    }

    /**
     * @param  list<Unit>  $unites
     * @return list<UnitData>
     */
    private function toData(array $unites): array
    {
        (new Collection($unites))->loadMissing('property');
        $types = $this->termes->findMany(array_map(fn (Unit $unite): string => $unite->unit_type_term_id, $unites), VocabularyKey::UnitType);

        return array_map(function (Unit $unite) use ($types): UnitData {
            $type = $types[$unite->unit_type_term_id];

            return new UnitData(
                id: $unite->id,
                propertyId: $unite->property_id,
                propertyName: $unite->property->name,
                address: $unite->property->address,
                reference: $unite->reference,
                unitTypeTermId: $type->id,
                unitTypeKey: $type->key,
                unitTypeSemantic: $type->semanticKey === null ? null : UnitTypeSemantic::tryFrom($type->semanticKey),
                floor: $unite->floor,
                surfaceHundredths: $unite->surface_hundredths,
                parentUnitId: $unite->parent_unit_id,
                isArchived: $unite->archived_at !== null,
            );
        }, $unites);
    }
}

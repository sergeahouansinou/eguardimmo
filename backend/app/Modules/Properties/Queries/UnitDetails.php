<?php

declare(strict_types=1);

namespace App\Modules\Properties\Queries;

use App\Modules\Catalog\Data\TermData;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\Tagger;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Properties\Models\Unit;
use App\Modules\Properties\Support\UnitNode;
use App\Modules\Properties\Support\UnitView;

final readonly class UnitDetails
{
    public function __construct(
        private Units $units,
        private TermDirectory $termes,
        private Tagger $etiqueteuse,
    ) {}

    public function get(string $id): UnitView
    {
        return $this->of($this->units->get($id));
    }

    public function of(Unit $unit): UnitView
    {
        $unit = $this->units->get($unit->id);
        $unit->load('property');

        return new UnitView($unit, $this->termes->find($unit->unit_type_term_id, VocabularyKey::UnitType), $this->etiqueteuse->tagsOf($unit->getMorphClass(), $unit->id));
    }

    /**
     * Types de lot des lignes d'une liste, résolus par lot.
     *
     * @param  iterable<Unit>  $units
     * @return array<string, TermData> par identifiant de valeur
     */
    public function typesOf(iterable $units): array
    {
        $ids = [];

        foreach ($units as $unit) {
            $ids[] = $unit->unit_type_term_id;
        }

        return $this->termes->findMany($ids, VocabularyKey::UnitType);
    }

    /**
     * Le lot et ses annexes actives, à tout niveau : un seul accès aux lots du site.
     */
    public function tree(Unit $racine): UnitNode
    {
        $actifs = $this->units->activeOfProperty($racine->property_id);
        $types = $this->typesOf([$racine, ...$actifs]);
        $parParent = [];

        foreach ($actifs as $unit) {
            if ($unit->parent_unit_id !== null) {
                $parParent[$unit->parent_unit_id][] = $unit;
            }
        }

        $racine->load('property');

        $construire = function (Unit $unit) use (&$construire, $types, $parParent): UnitNode {
            return new UnitNode($unit, $types[$unit->unit_type_term_id], array_map($construire, $parParent[$unit->id] ?? []));
        };

        return $construire($racine);
    }
}

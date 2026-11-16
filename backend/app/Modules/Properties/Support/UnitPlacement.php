<?php

declare(strict_types=1);

namespace App\Modules\Properties\Support;

use App\Modules\Properties\Enums\ErrorCode;
use App\Modules\Properties\Models\Property;
use App\Modules\Properties\Models\Unit;
use App\Modules\Properties\Queries\Units;

/**
 * Règles de placement d'un lot dans son site. Appelé sous le verrou du site : les contrôles ne se doublent pas entre requêtes.
 */
final readonly class UnitPlacement
{
    public function __construct(private Units $units) {}

    /**
     * Le parent d'une annexe : un lot actif du même site, hors de la descendance du lot déplacé.
     */
    public function parent(Property $property, string $parentId, ?Unit $deplace = null): Unit
    {
        $parent = $this->units->get($parentId);

        if ($parent->property_id !== $property->id) {
            throw ErrorCode::UnitParentOtherProperty->problem();
        }

        if ($deplace !== null && $this->descendsFrom($property->id, $parent->id, $deplace->id)) {
            throw ErrorCode::UnitParentCycle->problem();
        }

        if ($parent->archived_at !== null) {
            throw ErrorCode::UnitArchived->problem();
        }

        return $parent;
    }

    /**
     * Une maison n'a qu'un lot principal actif ; ses annexes ne comptent pas.
     */
    public function assertRootRoom(Property $property, ?string $except = null): void
    {
        if (! $property->type->singleUnit()) {
            return;
        }

        $existe = Unit::query()
            ->where('property_id', $property->id)
            ->whereNull('parent_unit_id')
            ->whereNull('archived_at')
            ->when($except !== null, fn ($q) => $q->where('id', '!=', $except))
            ->exists();

        if ($existe) {
            throw ErrorCode::HouseSingleUnit->problem();
        }
    }

    public function assertReferenceFree(Property $property, string $reference, ?string $except = null): void
    {
        $prise = Unit::query()
            ->where('property_id', $property->id)
            ->where('reference', $reference)
            ->when($except !== null, fn ($q) => $q->where('id', '!=', $except))
            ->exists();

        if ($prise) {
            throw ErrorCode::UnitReferenceTaken->problem();
        }
    }

    private function descendsFrom(string $propertyId, string $lotId, string $ancetreId): bool
    {
        $parents = Unit::query()->where('property_id', $propertyId)->pluck('parent_unit_id', 'id')->all();
        $vus = [];

        for ($courant = $lotId; $courant !== null && ! isset($vus[$courant]); $courant = $parents[$courant] ?? null) {
            if ($courant === $ancetreId) {
                return true;
            }

            $vus[$courant] = true;
        }

        return false;
    }
}

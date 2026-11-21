<?php

declare(strict_types=1);

namespace App\Modules\Properties\Actions;

use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Modules\Properties\Enums\ErrorCode;
use App\Modules\Properties\Models\Property;
use App\Modules\Properties\Models\PropertyContact;
use App\Modules\Properties\Queries\Units;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

final readonly class AddPropertyContact
{
    public function __construct(
        private Units $units,
        private PartyDirectory $parties,
        private TermDirectory $termes,
    ) {}

    /**
     * Le lot, s'il est donné, doit appartenir au site : un lot d'un autre site se présente comme inconnu.
     */
    public function handle(Property $property, string $partyId, ?string $unitId, ?string $categoryTermId): PropertyContact
    {
        if ($unitId !== null && $this->units->get($unitId)->property_id !== $property->id) {
            throw ErrorCode::UnitNotFound->problem();
        }

        if ($this->parties->find($partyId)->isAnonymized) {
            throw ErrorCode::ContactAnonymized->problem();
        }

        if ($categoryTermId !== null) {
            $this->termes->findAssignable($categoryTermId, VocabularyKey::ContactCategory);
        }

        try {
            return DB::transaction(function () use ($property, $partyId, $unitId, $categoryTermId): PropertyContact {
                $existe = PropertyContact::query()
                    ->where('property_id', $property->id)
                    ->where('party_id', $partyId)
                    ->when($unitId === null, fn ($q) => $q->whereNull('unit_id'), fn ($q) => $q->where('unit_id', $unitId))
                    ->exists();

                if ($existe) {
                    throw ErrorCode::PropertyContactExists->problem();
                }

                return PropertyContact::query()->create([
                    'property_id' => $property->id,
                    'unit_id' => $unitId,
                    'party_id' => $partyId,
                    'contact_category_term_id' => $categoryTermId,
                ]);
            });
        } catch (UniqueConstraintViolationException) {
            throw ErrorCode::PropertyContactExists->problem();
        }
    }
}

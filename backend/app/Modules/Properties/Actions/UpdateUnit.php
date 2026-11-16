<?php

declare(strict_types=1);

namespace App\Modules\Properties\Actions;

use App\Modules\Catalog\Enums\CustomFieldEntity;
use App\Modules\Catalog\Enums\UnitTypeSemantic;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\CustomFieldValidator;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Properties\Data\UnitChangesData;
use App\Modules\Properties\Enums\ErrorCode;
use App\Modules\Properties\Models\Unit;
use App\Modules\Properties\Queries\Properties;
use App\Modules\Properties\Queries\Units;
use App\Modules\Properties\Support\UnitCharacteristics;
use App\Modules\Properties\Support\UnitPlacement;
use Illuminate\Support\Facades\DB;

final readonly class UpdateUnit
{
    public function __construct(
        private Properties $properties,
        private Units $units,
        private TermDirectory $termes,
        private CustomFieldValidator $champs,
        private UnitPlacement $placement,
        private SyncTags $etiquettes,
    ) {}

    public function handle(Unit $unit, UnitChangesData $changements): Unit
    {
        return DB::transaction(function () use ($unit, $changements): Unit {
            $site = $this->properties->locked($unit->property_id);
            $lot = $this->units->locked($unit->id);

            if ($lot->lock_version !== $changements->lockVersion) {
                throw ErrorCode::UnitVersionConflict->problem();
            }

            $champs = $changements->fields;

            if (array_key_exists('parent_unit_id', $champs) && $champs['parent_unit_id'] !== $lot->parent_unit_id) {
                if (is_string($champs['parent_unit_id'])) {
                    $this->placement->parent($site, $champs['parent_unit_id'], $lot);
                } else {
                    $this->placement->assertRootRoom($site, $lot->id);
                }

                $lot->parent_unit_id = is_string($champs['parent_unit_id']) ? $champs['parent_unit_id'] : null;
            }

            if (isset($champs['reference']) && $champs['reference'] !== $lot->reference) {
                $this->placement->assertReferenceFree($site, (string) $champs['reference'], $lot->id);
                $lot->reference = (string) $champs['reference'];
            }

            foreach (['floor', 'surface_hundredths'] as $cle) {
                if (array_key_exists($cle, $champs)) {
                    $lot->setAttribute($cle, $champs[$cle]);
                }
            }

            $typeId = isset($champs['unit_type_term_id']) ? (string) $champs['unit_type_term_id'] : $lot->unit_type_term_id;
            $type = $typeId === $lot->unit_type_term_id
                ? $this->termes->find($typeId, VocabularyKey::UnitType)
                : $this->termes->findAssignable($typeId, VocabularyKey::UnitType);

            if ($changements->characteristics !== null || $typeId !== $lot->unit_type_term_id) {
                $lot->characteristics = UnitCharacteristics::validate(
                    $type->semanticKey === null ? null : UnitTypeSemantic::tryFrom($type->semanticKey),
                    $changements->characteristics ?? $lot->characteristics,
                );
            }

            $lot->unit_type_term_id = $type->id;

            $personnalises = $changements->customFields === null
                ? $lot->custom_fields
                : $this->champs->validate(CustomFieldEntity::Unit, $changements->customFields, $lot->custom_fields);

            $lot->custom_fields = $personnalises;
            $lot->lock_version = $lot->lock_version + 1;
            $lot->save();

            if ($changements->customFields !== null) {
                $this->champs->recordUsage(CustomFieldEntity::Unit, $personnalises);
            }

            if ($changements->tagIds !== null) {
                $this->etiquettes->handle($lot, $changements->tagIds);
            }

            return $lot;
        });
    }
}

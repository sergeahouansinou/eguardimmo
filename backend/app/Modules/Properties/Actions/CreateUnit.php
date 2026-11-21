<?php

declare(strict_types=1);

namespace App\Modules\Properties\Actions;

use App\Modules\Catalog\Enums\CustomFieldEntity;
use App\Modules\Catalog\Enums\UnitTypeSemantic;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\CustomFieldValidator;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Properties\Data\NewUnitData;
use App\Modules\Properties\Enums\ErrorCode;
use App\Modules\Properties\Models\Unit;
use App\Modules\Properties\Queries\Properties;
use App\Modules\Properties\Support\UnitCharacteristics;
use App\Modules\Properties\Support\UnitPlacement;
use App\Modules\Subscriptions\Enums\Feature;
use App\Modules\Subscriptions\PublicApi\Entitlements;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;

final readonly class CreateUnit
{
    public function __construct(
        private Properties $properties,
        private TermDirectory $termes,
        private CustomFieldValidator $champs,
        private UnitPlacement $placement,
        private SyncTags $etiquettes,
        private Entitlements $droits,
        private CurrentOrganization $organisation,
    ) {}

    public function handle(NewUnitData $donnees): Unit
    {
        return DB::transaction(function () use ($donnees): Unit {
            $this->droits->assertWithin($this->organisation->id(), Feature::Properties, fn (): int => Unit::query()->whereNull('archived_at')->count());
            $site = $this->properties->locked($donnees->propertyId);

            if ($site->archived_at !== null) {
                throw ErrorCode::PropertyArchived->problem();
            }

            $type = $this->termes->findAssignable($donnees->unitTypeTermId, VocabularyKey::UnitType);
            $caracteristiques = UnitCharacteristics::validate(
                $type->semanticKey === null ? null : UnitTypeSemantic::tryFrom($type->semanticKey),
                $donnees->characteristics,
            );
            $personnalises = $this->champs->validate(CustomFieldEntity::Unit, $donnees->customFields);

            if ($donnees->parentUnitId === null) {
                $this->placement->assertRootRoom($site);
            } else {
                $this->placement->parent($site, $donnees->parentUnitId);
            }

            $this->placement->assertReferenceFree($site, $donnees->reference);

            $lot = Unit::query()->create([
                'property_id' => $site->id,
                'parent_unit_id' => $donnees->parentUnitId,
                'unit_type_term_id' => $type->id,
                'reference' => $donnees->reference,
                'floor' => $donnees->floor,
                'surface_hundredths' => $donnees->surfaceHundredths,
                'characteristics' => $caracteristiques,
                'custom_fields' => $personnalises,
                'lock_version' => 1,
            ]);

            $this->champs->recordUsage(CustomFieldEntity::Unit, $personnalises);
            $this->etiquettes->handle($lot, $donnees->tagIds);

            return $lot;
        });
    }
}

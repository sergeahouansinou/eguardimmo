<?php

declare(strict_types=1);

namespace App\Modules\Properties\Actions;

use App\Modules\Catalog\Enums\CustomFieldEntity;
use App\Modules\Catalog\PublicApi\CustomFieldValidator;
use App\Modules\Properties\Data\PropertyChangesData;
use App\Modules\Properties\Enums\ErrorCode;
use App\Modules\Properties\Models\Property;
use App\Modules\Properties\Models\Unit;
use App\Modules\Properties\Queries\Properties;
use Illuminate\Support\Facades\DB;

final readonly class UpdateProperty
{
    public function __construct(
        private Properties $properties,
        private CustomFieldValidator $champs,
        private SyncTags $etiquettes,
    ) {}

    public function handle(Property $property, PropertyChangesData $changements): Property
    {
        return DB::transaction(function () use ($property, $changements): Property {
            $site = $this->properties->locked($property->id);

            if ($site->lock_version !== $changements->lockVersion) {
                throw ErrorCode::PropertyVersionConflict->problem();
            }

            if ($changements->type !== null && $changements->type !== $site->type && $changements->type->singleUnit()) {
                $principaux = Unit::query()->where('property_id', $site->id)->whereNull('parent_unit_id')->whereNull('archived_at')->count();

                if ($principaux > 1) {
                    throw ErrorCode::HouseSingleUnit->problem();
                }
            }

            $personnalises = $changements->customFields === null
                ? $site->custom_fields
                : $this->champs->validate(CustomFieldEntity::Property, $changements->customFields, $site->custom_fields);

            $site->fill([
                'name' => $changements->name ?? $site->name,
                'type' => $changements->type ?? $site->type,
                'address' => $changements->address ?? $site->address,
                'custom_fields' => $personnalises,
                'lock_version' => $site->lock_version + 1,
            ]);
            $site->save();

            if ($changements->customFields !== null) {
                $this->champs->recordUsage(CustomFieldEntity::Property, $personnalises);
            }

            if ($changements->tagIds !== null) {
                $this->etiquettes->handle($site, $changements->tagIds);
            }

            return $site;
        });
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Properties\Actions;

use App\Modules\Catalog\Enums\CustomFieldEntity;
use App\Modules\Catalog\PublicApi\CustomFieldValidator;
use App\Modules\Properties\Data\NewPropertyData;
use App\Modules\Properties\Models\Property;
use Illuminate\Support\Facades\DB;

final readonly class CreateProperty
{
    public function __construct(
        private CustomFieldValidator $champs,
        private SyncTags $etiquettes,
    ) {}

    public function handle(NewPropertyData $donnees): Property
    {
        return DB::transaction(function () use ($donnees): Property {
            $personnalises = $this->champs->validate(CustomFieldEntity::Property, $donnees->customFields);

            $site = Property::query()->create([
                'name' => $donnees->name,
                'type' => $donnees->type,
                'address' => $donnees->address,
                'custom_fields' => $personnalises,
                'lock_version' => 1,
            ]);

            $this->champs->recordUsage(CustomFieldEntity::Property, $personnalises);
            $this->etiquettes->handle($site, $donnees->tagIds);

            return $site;
        });
    }
}

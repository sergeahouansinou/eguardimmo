<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Queries;

use App\Modules\Catalog\Enums\CustomFieldEntity;
use App\Modules\Catalog\Enums\ErrorCode;
use App\Modules\Catalog\Models\CustomFieldDefinition;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Str;

final class CustomFields
{
    /**
     * @return Collection<int, CustomFieldDefinition>
     */
    public function list(CustomFieldEntity $entity, bool $includeArchived): Collection
    {
        $requete = CustomFieldDefinition::query()->where('entity', $entity->value);

        if (! $includeArchived) {
            $requete->whereNull('archived_at');
        }

        return $requete->orderBy('position')->orderBy('key')->get();
    }

    public function get(string $id): CustomFieldDefinition
    {
        return (Str::isUuid($id) ? CustomFieldDefinition::query()->find($id) : null) ?? throw ErrorCode::CustomFieldNotFound->problem();
    }
}

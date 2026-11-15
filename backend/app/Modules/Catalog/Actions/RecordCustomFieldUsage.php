<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Actions;

use App\Modules\Catalog\Enums\CustomFieldEntity;
use App\Modules\Catalog\Models\CustomFieldDefinition;

final readonly class RecordCustomFieldUsage
{
    /**
     * @param  array<string, mixed>  $values
     */
    public function handle(CustomFieldEntity $entity, array $values): void
    {
        CustomFieldDefinition::query()
            ->where('entity', $entity->value)
            ->whereIn('key', array_map('strval', array_keys($values)))
            ->whereNull('values_recorded_at')
            ->get()
            ->each(fn (CustomFieldDefinition $champ): bool => $champ->forceFill(['values_recorded_at' => now()])->save());
    }
}

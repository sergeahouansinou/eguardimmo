<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Actions;

use App\Modules\Catalog\Data\NewCustomFieldData;
use App\Modules\Catalog\Enums\ErrorCode;
use App\Modules\Catalog\Models\CustomFieldDefinition;
use App\Modules\Catalog\Support\CustomFieldShape;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

final readonly class CreateCustomField
{
    public const LIMITE_PAR_OBJET = 100;

    public function handle(NewCustomFieldData $donnees): CustomFieldDefinition
    {
        CustomFieldShape::assert($donnees->type, $donnees->vocabulary?->value, $donnees->options);

        try {
            return DB::transaction(function () use ($donnees): CustomFieldDefinition {
                $existantes = CustomFieldDefinition::query()->where('entity', $donnees->entity->value);

                if ($existantes->clone()->where('key', $donnees->key)->exists()) {
                    throw ErrorCode::CustomFieldKeyTaken->problem();
                }

                if ($existantes->clone()->count() >= self::LIMITE_PAR_OBJET) {
                    throw ErrorCode::CustomFieldLimitReached->problem();
                }

                $derniere = $existantes->clone()->max('position');

                return CustomFieldDefinition::query()->create([
                    'entity' => $donnees->entity,
                    'key' => $donnees->key,
                    'labels' => $donnees->labels,
                    'type' => $donnees->type,
                    'vocabulary' => $donnees->vocabulary?->value,
                    'options' => $donnees->options,
                    'required' => $donnees->required,
                    'position' => is_numeric($derniere) ? (int) $derniere + 1 : 0,
                ]);
            });
        } catch (UniqueConstraintViolationException) {
            throw ErrorCode::CustomFieldKeyTaken->problem();
        }
    }
}

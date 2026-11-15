<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Database\Factories;

use App\Modules\Catalog\Enums\CustomFieldEntity;
use App\Modules\Catalog\Enums\CustomFieldType;
use App\Modules\Catalog\Models\CustomFieldDefinition;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CustomFieldDefinition>
 */
final class CustomFieldDefinitionFactory extends Factory
{
    protected $model = CustomFieldDefinition::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'entity' => CustomFieldEntity::Unit,
            'key' => 'champ_'.fake()->unique()->bothify('????##'),
            'labels' => ['fr' => fake()->word()],
            'type' => CustomFieldType::Text,
            'required' => false,
            'position' => 0,
        ];
    }
}

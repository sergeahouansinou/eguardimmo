<?php

declare(strict_types=1);

namespace App\Modules\Properties\Database\Factories;

use App\Modules\Properties\Enums\PropertyType;
use App\Modules\Properties\Models\Property;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Property>
 */
final class PropertyFactory extends Factory
{
    protected $model = Property::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => 'Résidence '.fake()->lastName(),
            'type' => PropertyType::Building,
            'address' => ['line1' => '12 rue du Port', 'postal_code' => '13002', 'city' => 'Marseille', 'country' => 'FR'],
            'custom_fields' => [],
            'lock_version' => 1,
        ];
    }
}

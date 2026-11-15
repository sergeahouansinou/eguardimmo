<?php

declare(strict_types=1);

namespace App\Modules\Properties\Database\Factories;

use App\Modules\Properties\Models\Property;
use App\Modules\Properties\Models\Unit;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Le type de lot (`unit_type_term_id`) est fourni par l'appelant : la valeur vient du référentiel de l'organisation.
 *
 * @extends Factory<Unit>
 */
final class UnitFactory extends Factory
{
    protected $model = Unit::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'property_id' => Property::factory(),
            'reference' => 'LOT-'.fake()->unique()->numberBetween(100, 99999),
            'floor' => 1,
            'surface_hundredths' => 5200,
            'characteristics' => [],
            'custom_fields' => [],
            'lock_version' => 1,
        ];
    }
}

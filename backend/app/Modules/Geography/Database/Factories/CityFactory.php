<?php

declare(strict_types=1);

namespace App\Modules\Geography\Database\Factories;

use App\Modules\Geography\Models\City;
use App\Modules\Geography\Models\Country;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<City>
 */
final class CityFactory extends Factory
{
    protected $model = City::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $nom = fake()->unique()->city();

        return [
            'country_id' => Country::query()->firstOrCreate(['code' => 'FR'], ['name' => 'France'])->id,
            'name' => $nom,
            'postal_code' => fake()->numerify('#####'),
            'slug' => str($nom)->slug()->toString().'-'.fake()->unique()->numerify('####'),
            'latitude' => '48.856600',
            'longitude' => '2.352200',
        ];
    }
}

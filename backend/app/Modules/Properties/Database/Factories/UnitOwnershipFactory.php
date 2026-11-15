<?php

declare(strict_types=1);

namespace App\Modules\Properties\Database\Factories;

use App\Modules\Properties\Enums\OwnershipNature;
use App\Modules\Properties\Models\UnitOwnership;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * `unit_id` et `party_id` sont fournis par l'appelant.
 *
 * @extends Factory<UnitOwnership>
 */
final class UnitOwnershipFactory extends Factory
{
    protected $model = UnitOwnership::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'share_bp' => 10000,
            'nature' => OwnershipNature::Full,
            'valid_from' => '2020-01-01',
        ];
    }
}

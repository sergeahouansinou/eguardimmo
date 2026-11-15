<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Database\Factories;

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Organization>
 */
final class OrganizationFactory extends Factory
{
    protected $model = Organization::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'kind' => OrganizationKind::Agency,
            'name' => fake()->company(),
            'country' => 'FR',
            'two_factor_required' => false,
            'created_by_user_id' => User::factory(),
        ];
    }
}

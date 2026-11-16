<?php

declare(strict_types=1);

namespace App\Modules\Leases\Database\Factories;

use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseUnit;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * `unit_id` est un lot de Properties : l'appelant fournit un lot réel quand le test en dépend.
 *
 * @extends Factory<LeaseUnit>
 */
final class LeaseUnitFactory extends Factory
{
    protected $model = LeaseUnit::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'lease_id' => Lease::factory(),
            'unit_id' => Str::uuid7()->toString(),
            'is_main' => true,
            'valid_from' => '2026-01-01',
        ];
    }
}

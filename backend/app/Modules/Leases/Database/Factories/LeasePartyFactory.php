<?php

declare(strict_types=1);

namespace App\Modules\Leases\Database\Factories;

use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseParty;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * `party_id` est une partie de Parties : l'appelant fournit une partie réelle quand le test en dépend.
 *
 * @extends Factory<LeaseParty>
 */
final class LeasePartyFactory extends Factory
{
    protected $model = LeaseParty::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'lease_id' => Lease::factory(),
            'party_id' => Str::uuid7()->toString(),
            'role' => LeasePartyRole::Tenant,
            'joint_liability' => true,
            'valid_from' => '2026-01-01',
        ];
    }
}

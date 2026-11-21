<?php

declare(strict_types=1);

namespace App\Modules\Parties\Database\Factories;

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Parties\Enums\OwnerAccessStatus;
use App\Modules\Parties\Models\OwnerAccess;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<OwnerAccess>
 */
final class OwnerAccessFactory extends Factory
{
    protected $model = OwnerAccess::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'role' => OwnerAccessRole::Holder,
            'status' => OwnerAccessStatus::Active,
            'invitation_id' => Str::uuid7()->toString(),
            'consent_version' => '2026-11',
            'consented_at' => now(),
            'identity_attested_by_user_id' => Str::uuid7()->toString(),
            'identity_attested_at' => now(),
        ];
    }
}

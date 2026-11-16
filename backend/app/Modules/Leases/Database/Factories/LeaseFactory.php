<?php

declare(strict_types=1);

namespace App\Modules\Leases\Database\Factories;

use App\Modules\Leases\Enums\BillingTiming;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Enums\Periodicity;
use App\Modules\Leases\Models\Lease;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Lease>
 */
final class LeaseFactory extends Factory
{
    protected $model = Lease::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'reference' => sprintf('BL-2026-%04d', fake()->unique()->numberBetween(1, 99999)),
            'jurisdiction' => 'FR',
            'regime_key' => 'fr.residential.unfurnished',
            'status' => LeaseStatus::Draft,
            'starts_on' => '2026-01-01',
            'duration_months' => 36,
            'tacit_renewal' => true,
            'ends_on' => '2029-01-01',
            'due_day' => 5,
            'periodicity' => Periodicity::Monthly,
            'billing_timing' => BillingTiming::Advance,
            'currency' => 'EUR',
            'jurisdiction_data' => [],
            'custom_fields' => [],
            'lock_version' => 1,
        ];
    }

    public function signed(string $le = '2025-12-15'): self
    {
        return $this->state(['status' => LeaseStatus::Signed, 'signed_on' => $le]);
    }
}

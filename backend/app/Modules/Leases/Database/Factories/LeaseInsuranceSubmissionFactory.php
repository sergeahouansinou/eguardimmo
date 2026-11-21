<?php

declare(strict_types=1);

namespace App\Modules\Leases\Database\Factories;

use App\Modules\Leases\Enums\InsuranceSubmissionStatus;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseInsuranceSubmission;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * `party_id` et `stored_file_id` viennent de l'appelant : une fiche et un fichier réels quand le test les lit.
 *
 * @extends Factory<LeaseInsuranceSubmission>
 */
final class LeaseInsuranceSubmissionFactory extends Factory
{
    protected $model = LeaseInsuranceSubmission::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'lease_id' => Lease::factory(),
            'party_id' => Str::uuid7()->toString(),
            'stored_file_id' => Str::uuid7()->toString(),
            'insurer' => 'Assureur Test',
            'policy_number' => 'POL-'.fake()->numerify('######'),
            'starts_on' => today()->subMonth()->toDateString(),
            'ends_on' => today()->addYear()->toDateString(),
            'client_id' => Str::uuid7()->toString(),
            'status' => InsuranceSubmissionStatus::Pending,
        ];
    }
}

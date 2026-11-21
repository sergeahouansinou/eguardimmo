<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Database\Factories;

use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Models\Mandate;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * `mandant_party_id` et `mandate_type_term_id` viennent d'autres modules : l'appelant fournit des lignes réelles quand le test en dépend.
 *
 * @extends Factory<Mandate>
 */
final class MandateFactory extends Factory
{
    protected $model = Mandate::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'reference' => sprintf('M-2026-%04d', fake()->unique()->numberBetween(1, 99999)),
            'mandant_party_id' => Str::uuid7()->toString(),
            'status' => MandateStatus::Draft,
            'starts_on' => '2026-01-01',
            'ends_on' => '2029-01-01',
            'tacit_renewal' => false,
            'renewal_months' => 12,
            'notice_months' => 3,
            'currency' => 'EUR',
            'custom_fields' => [],
            'lock_version' => 1,
        ];
    }

    public function active(string $signeLe = '2025-12-15'): self
    {
        return $this->state(['status' => MandateStatus::Active, 'signed_on' => $signeLe]);
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Leases\Database\Factories;

use App\Modules\Leases\Enums\TermChangeReason;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseTerm;
use Illuminate\Database\Eloquent\Factories\Factory;
use Money\Money;

/**
 * La composante (`component_term_id`) vient du référentiel `lease_component` de l'organisation : l'appelant la fournit.
 *
 * @extends Factory<LeaseTerm>
 */
final class LeaseTermFactory extends Factory
{
    protected $model = LeaseTerm::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'lease_id' => Lease::factory(),
            'amount' => Money::EUR(65000),
            'vat_bp' => 0,
            'indexed' => true,
            'valid_from' => '2026-01-01',
            'reason' => TermChangeReason::Initial,
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Database\Factories;

use App\Modules\Mandates\Enums\FeeKind;
use App\Modules\Mandates\Enums\TermChangeReason;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Models\MandateTerm;
use Illuminate\Database\Eloquent\Factories\Factory;
use Money\Money;

/**
 * @extends Factory<MandateTerm>
 */
final class MandateTermFactory extends Factory
{
    protected $model = MandateTerm::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'mandate_id' => Mandate::factory(),
            'fee_kind' => FeeKind::Percentage,
            'fee_basis_points' => 700,
            'fee_flat_amount' => null,
            'currency' => 'EUR',
            'payout_day' => 5,
            'works_limit_amount' => Money::EUR(50000),
            'valid_from' => '2026-01-01',
            'reason' => TermChangeReason::Initial,
        ];
    }
}

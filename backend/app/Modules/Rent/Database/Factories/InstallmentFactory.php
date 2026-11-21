<?php

declare(strict_types=1);

namespace App\Modules\Rent\Database\Factories;

use App\Modules\Rent\Enums\InstallmentStatus;
use App\Modules\Rent\Models\Installment;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;
use Money\Money;

/**
 * `lease_id` vient d'un autre module : l'appelant fournit un bail réel quand le test en dépend.
 *
 * @extends Factory<Installment>
 */
final class InstallmentFactory extends Factory
{
    protected $model = Installment::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'lease_id' => Str::uuid7()->toString(),
            'period_start' => '2026-11-01',
            'period_end' => '2026-11-30',
            'due_date' => '2026-11-05',
            'status' => InstallmentStatus::Upcoming,
            'currency' => 'EUR',
            'rent_amount' => Money::EUR(65000),
            'charges_amount' => Money::EUR(5000),
            'vat_amount' => Money::EUR(0),
            'total_amount' => Money::EUR(70000),
        ];
    }
}

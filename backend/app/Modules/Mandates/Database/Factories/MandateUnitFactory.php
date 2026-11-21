<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Database\Factories;

use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Models\MandateUnit;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * `unit_id` est un lot de Properties : l'appelant fournit un lot réel quand le test en dépend.
 *
 * @extends Factory<MandateUnit>
 */
final class MandateUnitFactory extends Factory
{
    protected $model = MandateUnit::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'mandate_id' => Mandate::factory(),
            'unit_id' => Str::uuid7()->toString(),
            'valid_from' => '2026-01-01',
        ];
    }
}

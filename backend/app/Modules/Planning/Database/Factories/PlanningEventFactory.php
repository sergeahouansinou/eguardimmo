<?php

declare(strict_types=1);

namespace App\Modules\Planning\Database\Factories;

use App\Modules\Planning\Enums\EventKind;
use App\Modules\Planning\Enums\Recurrence;
use App\Modules\Planning\Models\PlanningEvent;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PlanningEvent>
 */
final class PlanningEventFactory extends Factory
{
    protected $model = PlanningEvent::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'kind' => EventKind::Appointment,
            'title' => fake()->sentence(3),
            'starts_on' => '2026-12-01',
            'start_time' => '10:00:00',
            'timezone' => 'Europe/Paris',
            'recurrence' => Recurrence::None,
            'created_by_user_id' => (string) fake()->uuid(),
            'lock_version' => 1,
        ];
    }
}

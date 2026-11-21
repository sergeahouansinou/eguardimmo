<?php

declare(strict_types=1);

namespace App\Modules\Planning\Database\Factories;

use App\Modules\Planning\Enums\TaskStatus;
use App\Modules\Planning\Models\PlanningTask;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PlanningTask>
 */
final class PlanningTaskFactory extends Factory
{
    protected $model = PlanningTask::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'title' => fake()->sentence(3),
            'due_on' => '2026-12-01',
            'status' => TaskStatus::Open,
            'created_by_user_id' => (string) fake()->uuid(),
            'lock_version' => 1,
        ];
    }
}

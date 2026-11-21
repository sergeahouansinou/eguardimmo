<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Organization;

use App\Modules\Charges\Actions\ComputeExercise;
use App\Modules\Charges\Http\Resources\ComputedExerciseResource;
use App\Modules\Charges\Queries\Exercises;

final class ComputeExerciseController
{
    public function __invoke(string $exercise, ComputeExercise $calculer, Exercises $exercices): ComputedExerciseResource
    {
        return new ComputedExerciseResource($calculer->handle($exercise), $exercices);
    }
}

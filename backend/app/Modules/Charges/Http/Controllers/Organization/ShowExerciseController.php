<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Organization;

use App\Modules\Charges\Http\Resources\ExerciseResource;
use App\Modules\Charges\Queries\Exercises;

final class ShowExerciseController
{
    public function __invoke(string $exercise, Exercises $exercices): ExerciseResource
    {
        $e = $exercices->get($exercise);

        return new ExerciseResource($e, $exercices->view($e));
    }
}

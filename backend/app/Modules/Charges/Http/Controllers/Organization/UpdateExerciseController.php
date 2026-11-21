<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Organization;

use App\Modules\Charges\Actions\UpdateExercise;
use App\Modules\Charges\Http\Requests\UpdateExerciseRequest;
use App\Modules\Charges\Http\Resources\ExerciseResource;
use App\Modules\Charges\Queries\Exercises;

final class UpdateExerciseController
{
    public function __invoke(string $exercise, UpdateExerciseRequest $request, UpdateExercise $modifier, Exercises $exercices): ExerciseResource
    {
        $e = $modifier->handle($exercise, $request->lockVersion(), $request->periodStart(), $request->periodEnd(), $request->itemsOrNull());

        return new ExerciseResource($e, $exercices->view($e));
    }
}

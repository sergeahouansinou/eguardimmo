<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Organization;

use App\Modules\Charges\Http\Requests\ListExercisesRequest;
use App\Modules\Charges\Http\Resources\ExercisePageResource;
use App\Modules\Charges\Queries\Exercises;

final class ListExercisesController
{
    public function __invoke(ListExercisesRequest $request, Exercises $exercices): ExercisePageResource
    {
        return new ExercisePageResource($exercices->page($request->filters(), $request->cursor(), $request->perPage()));
    }
}

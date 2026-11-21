<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Organization;

use App\Modules\Charges\Actions\CreateExercise;
use App\Modules\Charges\Http\Requests\StoreExerciseRequest;
use App\Modules\Charges\Http\Resources\ExerciseResource;
use App\Modules\Charges\Queries\Exercises;
use Illuminate\Http\JsonResponse;

final class StoreExerciseController
{
    public function __invoke(StoreExerciseRequest $request, CreateExercise $creer, Exercises $exercices): JsonResponse
    {
        $e = $creer->handle($request->propertyId(), $request->periodStart(), $request->periodEnd(), $request->items());

        return (new ExerciseResource($e, $exercices->view($e)))->response()->setStatusCode(201);
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Organization;

use App\Modules\Charges\Actions\IssueExercise;
use App\Modules\Charges\Http\Requests\IssueExerciseRequest;
use App\Modules\Charges\Http\Resources\ExerciseResource;
use App\Modules\Charges\Http\Support\IdempotencyHeader;
use App\Modules\Charges\Queries\Exercises;

final class IssueExerciseController
{
    public function __invoke(string $exercise, IssueExerciseRequest $request, IssueExercise $emettre, Exercises $exercices): ExerciseResource
    {
        $e = $emettre->handle($exercise, IdempotencyHeader::read($request), $request->prescriptionAcknowledged());

        return new ExerciseResource($e, $exercices->view($e));
    }
}

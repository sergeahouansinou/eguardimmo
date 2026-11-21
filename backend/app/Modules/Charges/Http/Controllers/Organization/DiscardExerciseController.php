<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Organization;

use App\Modules\Charges\Actions\DiscardExercise;
use App\Modules\Charges\Http\Resources\ExerciseResource;

final class DiscardExerciseController
{
    public function __invoke(string $exercise, DiscardExercise $ecarter): ExerciseResource
    {
        return new ExerciseResource($ecarter->handle($exercise));
    }
}

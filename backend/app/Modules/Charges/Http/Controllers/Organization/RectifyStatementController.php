<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Organization;

use App\Modules\Charges\Actions\RectifyStatement;
use App\Modules\Charges\Http\Requests\ReasonRequest;
use App\Modules\Charges\Http\Resources\ExerciseResource;
use App\Modules\Charges\Http\Support\IdempotencyHeader;
use App\Modules\Charges\Queries\Exercises;
use Illuminate\Http\JsonResponse;

final class RectifyStatementController
{
    public function __invoke(string $statement, ReasonRequest $request, RectifyStatement $rectifier, Exercises $exercices): JsonResponse
    {
        $e = $rectifier->handle($statement, $request->reason(), IdempotencyHeader::read($request));

        return (new ExerciseResource($e, $exercices->view($e)))->response()->setStatusCode(201);
    }
}

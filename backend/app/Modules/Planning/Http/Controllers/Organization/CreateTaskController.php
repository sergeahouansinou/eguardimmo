<?php

declare(strict_types=1);

namespace App\Modules\Planning\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Planning\Actions\CreateTask;
use App\Modules\Planning\Http\Requests\CreateTaskRequest;
use App\Modules\Planning\Http\Resources\TaskResource;
use App\Modules\Planning\Queries\Tasks;
use Illuminate\Http\JsonResponse;

final class CreateTaskController
{
    public function __invoke(CreateTaskRequest $request, CreateTask $creer, Tasks $taches): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $resultat = $creer->handle($user->id, $request->toData());

        return (new TaskResource($taches->view($resultat['task'])))->response()->setStatusCode($resultat['replayed'] ? 200 : 201);
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Planning\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Planning\Actions\UpdateTask;
use App\Modules\Planning\Http\Requests\UpdateTaskRequest;
use App\Modules\Planning\Http\Resources\TaskResource;
use App\Modules\Planning\Queries\Tasks;

final class UpdateTaskController
{
    public function __invoke(string $task, UpdateTaskRequest $request, Tasks $taches, UpdateTask $modifier): TaskResource
    {
        /** @var User $user */
        $user = $request->user();

        return new TaskResource($taches->view($modifier->handle($taches->get($task), $user->id, $request->toData())));
    }
}

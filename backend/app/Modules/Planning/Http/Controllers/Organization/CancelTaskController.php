<?php

declare(strict_types=1);

namespace App\Modules\Planning\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Planning\Actions\ChangeTaskStatus;
use App\Modules\Planning\Enums\TaskStatus;
use App\Modules\Planning\Http\Resources\TaskResource;
use App\Modules\Planning\Queries\Tasks;
use Illuminate\Http\Request;

final class CancelTaskController
{
    public function __invoke(string $task, Request $request, Tasks $taches, ChangeTaskStatus $statut): TaskResource
    {
        /** @var User $user */
        $user = $request->user();

        return new TaskResource($taches->view($statut->handle($taches->get($task), $user->id, TaskStatus::Cancelled)));
    }
}

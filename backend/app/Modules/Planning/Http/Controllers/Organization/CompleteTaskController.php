<?php

declare(strict_types=1);

namespace App\Modules\Planning\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Planning\Actions\ChangeTaskStatus;
use App\Modules\Planning\Enums\TaskStatus;
use App\Modules\Planning\Http\Resources\TaskResource;
use App\Modules\Planning\Queries\Tasks;
use App\Modules\Planning\Support\TaskAccess;
use Illuminate\Http\Request;

final class CompleteTaskController
{
    public function __invoke(string $task, Request $request, Tasks $taches, TaskAccess $acces, ChangeTaskStatus $statut): TaskResource
    {
        /** @var User $user */
        $user = $request->user();
        $tache = $taches->get($task);
        $acces->assertCanProgress($user, $tache);

        return new TaskResource($taches->view($statut->handle($tache, $user->id, TaskStatus::Done)));
    }
}

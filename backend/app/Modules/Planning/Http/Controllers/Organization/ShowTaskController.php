<?php

declare(strict_types=1);

namespace App\Modules\Planning\Http\Controllers\Organization;

use App\Modules\Planning\Http\Resources\TaskResource;
use App\Modules\Planning\Queries\Tasks;

final class ShowTaskController
{
    public function __invoke(string $task, Tasks $taches): TaskResource
    {
        return new TaskResource($taches->view($taches->get($task)));
    }
}

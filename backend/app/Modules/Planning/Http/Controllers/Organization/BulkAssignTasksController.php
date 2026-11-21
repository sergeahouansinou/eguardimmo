<?php

declare(strict_types=1);

namespace App\Modules\Planning\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Planning\Actions\BulkAssignTasks;
use App\Modules\Planning\Http\Requests\BulkAssignTasksRequest;
use Illuminate\Http\JsonResponse;

final class BulkAssignTasksController
{
    public function __invoke(BulkAssignTasksRequest $request, BulkAssignTasks $confier): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json(['data' => ['count' => $confier->handle($user->id, $request->ids(), $request->assigneeUserId())]]);
    }
}

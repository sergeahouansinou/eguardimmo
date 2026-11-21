<?php

declare(strict_types=1);

namespace App\Modules\Planning\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Planning\Actions\BulkCompleteTasks;
use App\Modules\Planning\Http\Requests\BulkCompleteTasksRequest;
use Illuminate\Http\JsonResponse;

final class BulkCompleteTasksController
{
    public function __invoke(BulkCompleteTasksRequest $request, BulkCompleteTasks $terminer): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json(['data' => ['count' => $terminer->handle($user->id, $request->ids())]]);
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Planning\Http\Controllers\Organization;

use App\Modules\Planning\Actions\BulkPostponeTasks;
use App\Modules\Planning\Http\Requests\BulkPostponeTasksRequest;
use Illuminate\Http\JsonResponse;

final class BulkPostponeTasksController
{
    public function __invoke(BulkPostponeTasksRequest $request, BulkPostponeTasks $reporter): JsonResponse
    {
        return response()->json(['data' => ['count' => $reporter->handle($request->ids(), $request->dueOn())]]);
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Controllers\Organization;

use App\Modules\Rent\Actions\IssuePendingReceipts;
use App\Modules\Rent\Http\Requests\BatchRequest;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class IssuePendingReceiptsController
{
    public function __invoke(BatchRequest $request, IssuePendingReceipts $emettre): JsonResponse
    {
        return response()->json(['data' => $emettre->handle(CarbonImmutable::today(), $request->limit())]);
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Organization;

use App\Modules\Charges\Actions\RecordInstallmentPlan;
use App\Modules\Charges\Http\Requests\InstallmentPlanRequest;
use App\Modules\Charges\Http\Resources\StatementResource;
use App\Modules\Charges\Http\Support\IdempotencyHeader;
use App\Modules\Charges\Queries\Statements;
use Illuminate\Http\JsonResponse;

final class RecordInstallmentPlanController
{
    public function __invoke(string $statement, InstallmentPlanRequest $request, RecordInstallmentPlan $etaler, Statements $decomptes): JsonResponse
    {
        $etaler->handle($statement, $request->reason(), $request->basis(), IdempotencyHeader::read($request));
        $d = $decomptes->get($statement);

        return (new StatementResource($d, $decomptes->lines($d), $decomptes->files($d), $decomptes->plan($d)))->response()->setStatusCode(201);
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Controllers\Organization;

use App\Modules\Banking\Actions\CreateBankRule;
use App\Modules\Banking\Http\Requests\StoreRuleRequest;
use App\Modules\Banking\Http\Resources\BankRuleResource;
use App\Modules\Banking\Support\Actor;
use Illuminate\Http\JsonResponse;

final class StoreRuleController
{
    public function __invoke(StoreRuleRequest $request, CreateBankRule $creation): JsonResponse
    {
        return (new BankRuleResource($creation->handle($request->toData(), Actor::id($request))))->response()->setStatusCode(201);
    }
}

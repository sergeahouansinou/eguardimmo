<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Controllers\Organization;

use App\Modules\Banking\Actions\ValidateReconciliation;
use App\Modules\Banking\Http\Resources\BankReconciliationResource;
use App\Modules\Banking\Support\Actor;
use App\Modules\Banking\Support\IdempotencyHeader;
use Illuminate\Http\Request;

final class ValidateReconciliationController
{
    public function __invoke(Request $request, string $reconciliation, ValidateReconciliation $validation): BankReconciliationResource
    {
        return new BankReconciliationResource($validation->handle($reconciliation, Actor::id($request), IdempotencyHeader::read($request))['reconciliation']);
    }
}

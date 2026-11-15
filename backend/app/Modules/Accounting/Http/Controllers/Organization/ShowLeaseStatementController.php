<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Http\Controllers\Organization;

use App\Modules\Accounting\Http\Requests\LeaseStatementRequest;
use App\Modules\Accounting\Http\Resources\LeaseStatementResource;
use App\Modules\Accounting\PublicApi\LedgerReader;

final class ShowLeaseStatementController
{
    public function __invoke(string $lease, LeaseStatementRequest $request, LedgerReader $lecture): LeaseStatementResource
    {
        return new LeaseStatementResource($lecture->leaseStatement($lease, $request->currency(), $request->from(), $request->to()));
    }
}

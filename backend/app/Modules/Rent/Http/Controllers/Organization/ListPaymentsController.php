<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Controllers\Organization;

use App\Modules\Rent\Http\Requests\ListPaymentsRequest;
use App\Modules\Rent\Http\Resources\PaymentPageResource;
use App\Modules\Rent\Queries\PaymentList;

final class ListPaymentsController
{
    public function __invoke(ListPaymentsRequest $request, PaymentList $liste): PaymentPageResource
    {
        return new PaymentPageResource($liste->list($request->leaseId(), $request->status(), $request->cursor(), $request->perPage()));
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Payments\Http\Controllers\Organization;

use App\Modules\Payments\Http\Requests\ListOnlinePaymentsRequest;
use App\Modules\Payments\Http\Resources\OnlinePaymentResource;
use App\Modules\Payments\Queries\OnlinePayments;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListOnlinePaymentsController
{
    public function __invoke(ListOnlinePaymentsRequest $request, OnlinePayments $paiements): AnonymousResourceCollection
    {
        return OnlinePaymentResource::collection($paiements->page($request->status(), $request->leaseId(), $request->perPage(), $request->cursor()));
    }
}

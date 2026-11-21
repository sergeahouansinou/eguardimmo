<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Controllers\Organization;

use App\Modules\Rent\Http\Requests\ListReceiptsRequest;
use App\Modules\Rent\Http\Resources\ReceiptPageResource;
use App\Modules\Rent\Queries\ReceiptList;

final class ListReceiptsController
{
    public function __invoke(ListReceiptsRequest $request, ReceiptList $liste): ReceiptPageResource
    {
        return new ReceiptPageResource($liste->list($request->leaseId(), $request->cursor(), $request->perPage()));
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Http\Controllers\Organization;

use App\Modules\Invoicing\Http\Requests\ListInvoicesRequest;
use App\Modules\Invoicing\Http\Resources\InvoicePageResource;
use App\Modules\Invoicing\Queries\Invoices;
use Carbon\CarbonImmutable;

final class ListInvoicesController
{
    public function __invoke(ListInvoicesRequest $request, Invoices $factures): InvoicePageResource
    {
        $page = $factures->list($request->filters(), $request->perPage(), CarbonImmutable::today());

        return new InvoicePageResource($page, $factures->outstanding($page->getCollection()));
    }
}

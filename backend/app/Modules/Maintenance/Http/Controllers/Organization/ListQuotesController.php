<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Http\Requests\ListQuotesRequest;
use App\Modules\Maintenance\Http\Resources\QuotePageResource;
use App\Modules\Maintenance\Queries\Quotes;

final class ListQuotesController
{
    public function __invoke(ListQuotesRequest $request, Quotes $devis): QuotePageResource
    {
        $page = $devis->page($request->filters());

        return new QuotePageResource($page, $devis->lookups($page->getCollection()));
    }
}

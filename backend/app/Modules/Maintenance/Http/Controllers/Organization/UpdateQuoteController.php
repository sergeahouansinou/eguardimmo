<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\UpdateQuote;
use App\Modules\Maintenance\Http\Requests\QuoteRequest;
use App\Modules\Maintenance\Http\Resources\QuoteResource;

final class UpdateQuoteController
{
    public function __invoke(string $intervention, string $quote, QuoteRequest $request, UpdateQuote $action): QuoteResource
    {
        $devis = $action->handle($intervention, $quote, $request->toData());
        $devis->load('lines');

        return new QuoteResource($devis);
    }
}

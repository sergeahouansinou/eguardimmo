<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\RecordQuote;
use App\Modules\Maintenance\Http\Requests\QuoteRequest;
use App\Modules\Maintenance\Http\Resources\QuoteResource;
use Illuminate\Http\JsonResponse;

final class StoreQuoteController
{
    public function __invoke(string $intervention, QuoteRequest $request, RecordQuote $action): JsonResponse
    {
        $devis = $action->handle($intervention, $request->toData());
        $devis->load('lines');

        return (new QuoteResource($devis))->response()->setStatusCode(201);
    }
}

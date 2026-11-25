<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Http\Controllers\Marketplace;

use App\Modules\Bookings\Actions\QuoteStay;
use App\Modules\Bookings\Http\Requests\QuoteStayRequest;
use App\Modules\Bookings\Http\Resources\QuoteResource;

final class QuoteStayController
{
    public function __invoke(string $ref, QuoteStayRequest $request, QuoteStay $devis): QuoteResource
    {
        return new QuoteResource($devis->handle($request->toData($ref)));
    }
}

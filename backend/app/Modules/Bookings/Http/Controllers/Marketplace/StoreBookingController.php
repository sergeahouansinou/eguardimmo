<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Http\Controllers\Marketplace;

use App\Modules\Bookings\Actions\CreateBooking;
use App\Modules\Bookings\Http\Requests\StoreBookingRequest;
use App\Modules\Bookings\Http\Resources\BookingResource;
use App\Modules\Bookings\Http\Support\IdempotencyHeader;
use App\Modules\Bookings\Queries\BookingViews;
use Illuminate\Http\JsonResponse;

final class StoreBookingController
{
    public function __invoke(StoreBookingRequest $request, CreateBooking $reserver, BookingViews $vues): JsonResponse
    {
        $resultat = $reserver->handle((string) $request->user()?->getAuthIdentifier(), $request->toData(), IdempotencyHeader::read($request));

        return (new BookingResource($vues->one($resultat['booking'])))->response()->setStatusCode($resultat['replayed'] ? 200 : 201);
    }
}

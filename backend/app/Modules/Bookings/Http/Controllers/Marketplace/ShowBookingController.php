<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Http\Controllers\Marketplace;

use App\Modules\Bookings\Http\Resources\BookingResource;
use App\Modules\Bookings\Queries\BookingLookup;
use App\Modules\Bookings\Queries\BookingViews;
use Illuminate\Http\Request;

final class ShowBookingController
{
    public function __invoke(string $booking, Request $request, BookingLookup $reservations, BookingViews $vues): BookingResource
    {
        return new BookingResource($vues->one($reservations->owned((string) $request->user()?->getAuthIdentifier(), $booking)));
    }
}

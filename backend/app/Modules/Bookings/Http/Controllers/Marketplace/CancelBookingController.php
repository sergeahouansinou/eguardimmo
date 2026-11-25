<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Http\Controllers\Marketplace;

use App\Modules\Bookings\Actions\CancelBooking;
use App\Modules\Bookings\Http\Resources\BookingResource;
use App\Modules\Bookings\Queries\BookingViews;
use Illuminate\Http\Request;

final class CancelBookingController
{
    public function __invoke(string $booking, Request $request, CancelBooking $annuler, BookingViews $vues): BookingResource
    {
        return new BookingResource($vues->one($annuler->handle((string) $request->user()?->getAuthIdentifier(), $booking)));
    }
}

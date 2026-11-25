<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Http\Controllers\Marketplace;

use App\Modules\Bookings\Http\Requests\ListBookingsRequest;
use App\Modules\Bookings\Http\Resources\BookingResource;
use App\Modules\Bookings\Queries\TravelerBookings;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListBookingsController
{
    public function __invoke(ListBookingsRequest $request, TravelerBookings $reservations): AnonymousResourceCollection
    {
        $page = $reservations->page((string) $request->user()?->getAuthIdentifier(), $request->status(), $request->perPage(), $request->cursorValue());

        return BookingResource::collection($page->items)->additional(['meta' => ['has_more' => $page->hasMore, 'next_cursor' => $page->nextCursor]]);
    }
}

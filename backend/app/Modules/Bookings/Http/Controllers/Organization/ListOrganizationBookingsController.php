<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Http\Controllers\Organization;

use App\Modules\Bookings\Http\Requests\ListBookingsRequest;
use App\Modules\Bookings\Http\Resources\OrganizationBookingResource;
use App\Modules\Bookings\Queries\OrganizationBookings;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListOrganizationBookingsController
{
    public function __invoke(ListBookingsRequest $request, OrganizationBookings $reservations): AnonymousResourceCollection
    {
        $page = $reservations->page($request->status(), $request->perPage(), $request->cursorValue());

        return OrganizationBookingResource::collection($page->items)->additional(['meta' => ['has_more' => $page->hasMore, 'next_cursor' => $page->nextCursor]]);
    }
}

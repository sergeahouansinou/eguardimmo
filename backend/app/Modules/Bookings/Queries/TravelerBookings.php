<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Queries;

use App\Modules\Bookings\Data\BookingPageData;
use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Bookings\Models\Booking;
use App\Shared\Tenancy\AcrossOrganizations;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;

/**
 * Réservations d'un voyageur : le filtre sur le compte authentifié est inconditionnel.
 */
final readonly class TravelerBookings
{
    public function __construct(private BookingViews $vues) {}

    public function page(string $userId, ?BookingStatus $statut, int $parPage, ?string $apres): BookingPageData
    {
        $page = AcrossOrganizations::query(Booking::class)
            ->where('user_id', $userId)
            ->when($statut !== null, fn (Builder $q) => $q->where('status', $statut?->value))
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $apres === null ? null : Cursor::fromEncoded($apres));

        /** @var list<Booking> $reservations */
        $reservations = array_values($page->items());

        return new BookingPageData($this->vues->many($reservations, false), $page->hasMorePages(), $page->nextCursor()?->encode());
    }
}

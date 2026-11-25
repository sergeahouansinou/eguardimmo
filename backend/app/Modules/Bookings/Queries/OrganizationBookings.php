<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Queries;

use App\Modules\Bookings\Data\BookingPageData;
use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Bookings\Models\Booking;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;

/**
 * Réservations des annonces de l'organisation courante : le scope global du modèle fait le cloisonnement.
 */
final readonly class OrganizationBookings
{
    public function __construct(private BookingViews $vues) {}

    public function page(?BookingStatus $statut, int $parPage, ?string $apres): BookingPageData
    {
        $page = Booking::query()
            ->when($statut !== null, fn (Builder $q) => $q->where('status', $statut?->value))
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $apres === null ? null : Cursor::fromEncoded($apres));

        /** @var list<Booking> $reservations */
        $reservations = array_values($page->items());

        return new BookingPageData($this->vues->many($reservations, true), $page->hasMorePages(), $page->nextCursor()?->encode());
    }
}

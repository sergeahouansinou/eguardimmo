<?php

declare(strict_types=1);

namespace App\Modules\Listings\Queries;

use App\Modules\Listings\Data\ListingPageData;
use App\Modules\Listings\Enums\ErrorCode;
use App\Modules\Listings\Enums\ListingStatus;
use App\Modules\Listings\Models\Listing;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;
use Illuminate\Support\Str;

/**
 * Annonces de l'organisation courante : le scope global du modèle fait le cloisonnement.
 */
final readonly class OrganizationListings
{
    public function __construct(private ListingViews $vues) {}

    public function get(string $id): Listing
    {
        return (Str::isUuid($id) ? Listing::query()->find($id) : null) ?? throw ErrorCode::ListingNotFound->problem();
    }

    public function page(?ListingStatus $statut, int $parPage, ?string $apres): ListingPageData
    {
        $page = Listing::query()
            ->when($statut !== null, fn (Builder $q) => $q->where('status', $statut?->value))
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $apres === null ? null : Cursor::fromEncoded($apres));

        /** @var list<Listing> $annonces */
        $annonces = array_values($page->items());

        return new ListingPageData($this->vues->many($annonces, false), $page->hasMorePages(), $page->nextCursor()?->encode());
    }
}

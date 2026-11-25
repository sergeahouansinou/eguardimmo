<?php

declare(strict_types=1);

namespace App\Modules\Listings\Queries;

use App\Modules\Listings\Data\ListingPageData;
use App\Modules\Listings\Data\ListingViewData;
use App\Modules\Listings\Enums\ErrorCode;
use App\Modules\Listings\Enums\ListingStatus;
use App\Modules\Listings\Models\Listing;
use App\Modules\Listings\Models\ListingFavorite;
use App\Modules\Listings\Support\PublicRef;
use App\Shared\Tenancy\AcrossOrganizations;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Pagination\Cursor;

/**
 * Favoris d'un compte : la clé est toujours l'identifiant du compte authentifié, jamais une donnée du client.
 */
final readonly class Favorites
{
    public function __construct(
        private ListingViews $vues,
        private PublicListings $annonces,
    ) {}

    public function page(string $userId, int $parPage, ?string $apres): ListingPageData
    {
        $page = ListingFavorite::query()
            ->where('user_id', $userId)
            ->whereIn('listing_id', fn (QueryBuilder $q) => $q->select('id')->from('listings')->where('status', ListingStatus::Published->value))
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $apres === null ? null : Cursor::fromEncoded($apres));

        $favoris = array_values($page->items());
        $annonces = AcrossOrganizations::query(Listing::class)->whereIn('id', array_map(fn (ListingFavorite $f): string => $f->listing_id, $favoris))->get()->keyBy('id');
        $ordonnees = [];

        foreach ($favoris as $favori) {
            $annonce = $annonces->get($favori->listing_id);

            if ($annonce instanceof Listing) {
                $ordonnees[] = $annonce;
            }
        }

        return new ListingPageData($this->vues->many($ordonnees, true), $page->hasMorePages(), $page->nextCursor()?->encode());
    }

    public function listingId(string $ref): ?string
    {
        if (! PublicRef::isValid($ref)) {
            return null;
        }

        return AcrossOrganizations::query(Listing::class)->where('public_ref', $ref)->value('id');
    }

    public function find(string $userId, string $ref): ListingViewData
    {
        $annonce = $this->annonces->published($ref);

        if (! ListingFavorite::query()->where('user_id', $userId)->where('listing_id', $annonce->id)->exists()) {
            throw ErrorCode::ListingNotFound->problem();
        }

        return $this->vues->one($annonce, true);
    }
}

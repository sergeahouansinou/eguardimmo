<?php

declare(strict_types=1);

namespace App\Modules\Listings\Actions;

use App\Modules\Listings\Models\ListingFavorite;
use App\Modules\Listings\Queries\Favorites;

final readonly class RemoveFavorite
{
    public function __construct(private Favorites $favoris) {}

    /**
     * Idempotent, et limité aux favoris du compte : l'annonce peut avoir été archivée entre-temps, le favori s'efface quand même.
     */
    public function handle(string $userId, string $ref): void
    {
        $annonceId = $this->favoris->listingId($ref);

        if ($annonceId !== null) {
            ListingFavorite::query()->where('user_id', $userId)->where('listing_id', $annonceId)->delete();
        }
    }
}

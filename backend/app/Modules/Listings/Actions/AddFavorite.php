<?php

declare(strict_types=1);

namespace App\Modules\Listings\Actions;

use App\Modules\Listings\Models\ListingFavorite;
use App\Modules\Listings\Queries\PublicListings;
use Illuminate\Database\UniqueConstraintViolationException;

final readonly class AddFavorite
{
    public function __construct(private PublicListings $annonces) {}

    /**
     * Idempotent : ajouter deux fois la même annonce ne crée qu'une ligne.
     */
    public function handle(string $userId, string $ref): void
    {
        $annonce = $this->annonces->published($ref);

        try {
            ListingFavorite::query()->firstOrCreate(['user_id' => $userId, 'listing_id' => $annonce->id]);
        } catch (UniqueConstraintViolationException) {
            // Une requête concurrente vient de créer le même favori : le résultat voulu est atteint.
        }
    }
}

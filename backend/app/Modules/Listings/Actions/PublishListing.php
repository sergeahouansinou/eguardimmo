<?php

declare(strict_types=1);

namespace App\Modules\Listings\Actions;

use App\Modules\Listings\Enums\ErrorCode;
use App\Modules\Listings\Enums\ListingStatus;
use App\Modules\Listings\Models\Listing;
use App\Modules\Listings\Support\IncompleteListing;
use Illuminate\Support\Facades\DB;

final readonly class PublishListing
{
    /**
     * La version lue par l'appelant doit être la courante, même quand l'annonce est déjà publiée (sans effet alors) ; une annonce archivée se republie.
     */
    public function handle(Listing $annonce, int $lockVersion): Listing
    {
        return DB::transaction(function () use ($annonce, $lockVersion): Listing {
            $courante = Listing::query()->whereKey($annonce->id)->lockForUpdate()->firstOrFail();

            if ($courante->lock_version !== $lockVersion) {
                throw ErrorCode::ListingStaleVersion->problem();
            }

            if ($courante->status === ListingStatus::Published) {
                return $courante;
            }

            if ($courante->missingForPublication() !== []) {
                throw IncompleteListing::problem($courante);
            }

            $courante->forceFill([
                'status' => ListingStatus::Published,
                'published_at' => now(),
                'lock_version' => $courante->lock_version + 1,
            ])->save();

            return $courante;
        });
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Listings\Actions;

use App\Modules\Listings\Enums\ErrorCode;
use App\Modules\Listings\Enums\ListingStatus;
use App\Modules\Listings\Models\Listing;
use Illuminate\Support\Facades\DB;

final readonly class ArchiveListing
{
    /**
     * Les réservations déjà prises restent valables : l'archivage retire seulement l'annonce de la recherche.
     */
    public function handle(Listing $annonce, int $lockVersion): Listing
    {
        return DB::transaction(function () use ($annonce, $lockVersion): Listing {
            $courante = Listing::query()->whereKey($annonce->id)->lockForUpdate()->firstOrFail();

            if ($courante->lock_version !== $lockVersion) {
                throw ErrorCode::ListingStaleVersion->problem();
            }

            if ($courante->status === ListingStatus::Archived) {
                return $courante;
            }

            $courante->forceFill(['status' => ListingStatus::Archived, 'lock_version' => $courante->lock_version + 1])->save();

            return $courante;
        });
    }
}

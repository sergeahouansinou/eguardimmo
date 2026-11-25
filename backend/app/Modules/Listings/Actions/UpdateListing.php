<?php

declare(strict_types=1);

namespace App\Modules\Listings\Actions;

use App\Modules\Geography\PublicApi\CityDirectory;
use App\Modules\Listings\Data\ListingChangesData;
use App\Modules\Listings\Enums\ErrorCode;
use App\Modules\Listings\Enums\ListingStatus;
use App\Modules\Listings\Models\Listing;
use App\Modules\Listings\Support\IncompleteListing;
use App\Modules\Listings\Support\ListingFields;
use Illuminate\Support\Facades\DB;

final readonly class UpdateListing
{
    public function __construct(private CityDirectory $villes) {}

    /**
     * Une annonce publiée doit rester complète : retirer le titre ou le prix la rendrait invisible mais « publiée ».
     */
    public function handle(Listing $annonce, ListingChangesData $changements): Listing
    {
        $champs = ListingFields::clean($changements->fields);

        if (isset($champs['city_id']) && $this->villes->find((string) $champs['city_id']) === null) {
            throw ErrorCode::ListingCityInvalid->problem();
        }

        return DB::transaction(function () use ($annonce, $changements, $champs): Listing {
            $courante = Listing::query()->whereKey($annonce->id)->lockForUpdate()->firstOrFail();

            if ($courante->status === ListingStatus::Archived) {
                throw ErrorCode::ListingArchived->problem();
            }

            if ($courante->lock_version !== $changements->lockVersion) {
                throw ErrorCode::ListingStaleVersion->problem();
            }

            $courante->fill($champs);

            if ($courante->status === ListingStatus::Published && $courante->missingForPublication() !== []) {
                throw IncompleteListing::problem($courante);
            }

            $courante->lock_version = $changements->lockVersion + 1;
            $courante->save();

            return $courante;
        });
    }
}

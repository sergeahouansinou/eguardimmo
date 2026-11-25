<?php

declare(strict_types=1);

namespace App\Modules\Listings\Queries;

use App\Modules\Geography\PublicApi\CityDirectory;
use App\Modules\Listings\Data\ListingViewData;
use App\Modules\Listings\Models\Listing;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use Carbon\CarbonImmutable;

final readonly class ListingViews
{
    public function __construct(
        private CityDirectory $villes,
        private OrganizationDirectory $organisations,
    ) {}

    /**
     * @param  list<Listing>  $annonces
     * @return list<ListingViewData>
     */
    public function many(array $annonces, bool $withHost): array
    {
        $villes = $this->villes->findMany(array_values(array_unique(array_filter(array_map(fn (Listing $a): ?string => $a->city_id, $annonces)))));
        $hotes = $withHost ? $this->organisations->names(array_values(array_unique(array_map(fn (Listing $a): string => $a->organization_id, $annonces)))) : [];

        return array_map(fn (Listing $a): ListingViewData => new ListingViewData(
            id: $a->id,
            ref: $a->public_ref,
            kind: $a->kind,
            category: $a->category,
            title: $a->title,
            description: $a->description,
            city: $a->city_id === null ? null : ($villes[$a->city_id] ?? null),
            neighbourhood: $a->neighbourhood,
            priceMinor: $a->price_minor,
            currency: $a->currency,
            priceUnit: $a->price_unit,
            capacity: $a->capacity,
            areaM2: $a->area_m2,
            rooms: $a->rooms,
            amenities: $a->amenities,
            minNights: $a->min_nights,
            cancellationPolicy: $a->cancellation_policy,
            depositMinor: $a->deposit_minor,
            status: $a->status,
            publishedAt: $a->published_at === null ? null : CarbonImmutable::instance($a->published_at),
            lockVersion: $a->lock_version,
            hostName: $hotes[$a->organization_id] ?? null,
            missing: $a->missingForPublication(),
        ), $annonces);
    }

    public function one(Listing $annonce, bool $withHost = false): ListingViewData
    {
        return $this->many([$annonce], $withHost)[0];
    }
}

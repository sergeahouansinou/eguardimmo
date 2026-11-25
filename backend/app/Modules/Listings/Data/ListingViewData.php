<?php

declare(strict_types=1);

namespace App\Modules\Listings\Data;

use App\Modules\Geography\Data\CityData;
use App\Modules\Listings\Enums\CancellationPolicy;
use App\Modules\Listings\Enums\ListingCategory;
use App\Modules\Listings\Enums\ListingKind;
use App\Modules\Listings\Enums\ListingStatus;
use App\Modules\Listings\Enums\PriceUnit;
use Carbon\CarbonImmutable;

final readonly class ListingViewData
{
    /**
     * @param  list<string>  $amenities
     * @param  list<string>  $missing  champs qui manquent pour publier
     */
    public function __construct(
        public string $id,
        public string $ref,
        public ListingKind $kind,
        public ListingCategory $category,
        public ?string $title,
        public ?string $description,
        public ?CityData $city,
        public ?string $neighbourhood,
        public ?int $priceMinor,
        public string $currency,
        public PriceUnit $priceUnit,
        public ?int $capacity,
        public ?int $areaM2,
        public ?int $rooms,
        public array $amenities,
        public int $minNights,
        public CancellationPolicy $cancellationPolicy,
        public ?int $depositMinor,
        public ListingStatus $status,
        public ?CarbonImmutable $publishedAt,
        public int $lockVersion,
        public ?string $hostName,
        public array $missing,
    ) {}
}

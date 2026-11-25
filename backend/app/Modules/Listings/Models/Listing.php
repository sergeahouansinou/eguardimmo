<?php

declare(strict_types=1);

namespace App\Modules\Listings\Models;

use App\Modules\Listings\Database\Factories\ListingFactory;
use App\Modules\Listings\Enums\CancellationPolicy;
use App\Modules\Listings\Enums\ListingCategory;
use App\Modules\Listings\Enums\ListingKind;
use App\Modules\Listings\Enums\ListingStatus;
use App\Modules\Listings\Enums\PriceUnit;
use App\Shared\Audit\Auditable;
use App\Shared\Audit\PreciseTimestamp;
use App\Shared\Tenancy\BelongsToOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property string $id
 * @property string $public_ref
 * @property string $organization_id
 * @property string|null $unit_id
 * @property ListingKind $kind
 * @property ListingCategory $category
 * @property string|null $title
 * @property string|null $description
 * @property string|null $city_id
 * @property string|null $neighbourhood
 * @property int|null $price_minor
 * @property string $currency
 * @property PriceUnit $price_unit
 * @property int|null $capacity
 * @property int|null $area_m2
 * @property int|null $rooms
 * @property list<string> $amenities
 * @property int $min_nights
 * @property CancellationPolicy $cancellation_policy
 * @property int|null $deposit_minor
 * @property ListingStatus $status
 * @property CarbonImmutable|null $published_at
 * @property int $lock_version
 */
#[UseFactory(ListingFactory::class)]
final class Listing extends Model
{
    use Auditable;
    use BelongsToOrganization;

    /** @use HasFactory<ListingFactory> */
    use HasFactory;

    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id', 'public_ref'];

    /**
     * Ce qui manque pour publier ; vide quand l'annonce est complète.
     *
     * @return list<string>
     */
    public function missingForPublication(): array
    {
        return array_keys(array_filter([
            'title' => $this->title === null || trim($this->title) === '',
            'price_minor' => $this->price_minor === null || $this->price_minor < 1,
            'city_id' => $this->city_id === null,
            'capacity' => $this->capacity === null || $this->capacity < 1,
        ]));
    }

    protected function casts(): array
    {
        return [
            'kind' => ListingKind::class,
            'category' => ListingCategory::class,
            'price_unit' => PriceUnit::class,
            'cancellation_policy' => CancellationPolicy::class,
            'status' => ListingStatus::class,
            'amenities' => 'array',
            'price_minor' => 'integer',
            'deposit_minor' => 'integer',
            'capacity' => 'integer',
            'area_m2' => 'integer',
            'rooms' => 'integer',
            'min_nights' => 'integer',
            'lock_version' => 'integer',
            'published_at' => PreciseTimestamp::class,
        ];
    }
}

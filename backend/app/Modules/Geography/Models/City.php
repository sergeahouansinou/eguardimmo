<?php

declare(strict_types=1);

namespace App\Modules\Geography\Models;

use App\Modules\Geography\Database\Factories\CityFactory;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Référentiel en lecture seule : aucun cloisonnement par organisation.
 *
 * @property string $id
 * @property string $country_id
 * @property string $name
 * @property string $postal_code
 * @property string $slug
 * @property string $latitude
 * @property string $longitude
 * @property Country|null $country
 */
#[UseFactory(CityFactory::class)]
final class City extends Model
{
    /** @use HasFactory<CityFactory> */
    use HasFactory;

    use HasUuids;

    protected $table = 'geo_cities';

    protected $guarded = ['id'];

    /**
     * @return BelongsTo<Country, $this>
     */
    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class, 'country_id');
    }
}

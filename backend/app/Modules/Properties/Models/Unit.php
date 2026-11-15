<?php

declare(strict_types=1);

namespace App\Modules\Properties\Models;

use App\Modules\Properties\Database\Factories\UnitFactory;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $property_id
 * @property string|null $parent_unit_id
 * @property string $unit_type_term_id
 * @property string $reference
 * @property int|null $floor
 * @property int|null $surface_hundredths
 * @property array<string, mixed> $characteristics
 * @property array<string, mixed> $custom_fields
 * @property int $lock_version
 * @property Carbon|null $archived_at
 * @property-read Property $property
 */
#[UseFactory(UnitFactory::class)]
final class Unit extends Model
{
    use Auditable;
    use BelongsToOrganization;

    /** @use HasFactory<UnitFactory> */
    use HasFactory;

    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    /**
     * @return BelongsTo<Property, $this>
     */
    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    /**
     * @return HasMany<UnitOwnership, $this>
     */
    public function ownerships(): HasMany
    {
        return $this->hasMany(UnitOwnership::class);
    }

    protected function casts(): array
    {
        return [
            'floor' => 'integer',
            'surface_hundredths' => 'integer',
            'characteristics' => 'array',
            'custom_fields' => 'array',
            'lock_version' => 'integer',
            'archived_at' => 'datetime',
        ];
    }
}

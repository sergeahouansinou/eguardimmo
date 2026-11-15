<?php

declare(strict_types=1);

namespace App\Modules\Properties\Models;

use App\Modules\Properties\Database\Factories\PropertyFactory;
use App\Modules\Properties\Enums\PropertyType;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $name
 * @property PropertyType $type
 * @property array{line1: string, line2?: string|null, postal_code: string, city: string, country: string} $address
 * @property array<string, mixed> $custom_fields
 * @property int $lock_version
 * @property Carbon|null $archived_at
 * @property-read int|null $active_units_count
 */
#[UseFactory(PropertyFactory::class)]
final class Property extends Model
{
    use Auditable;
    use BelongsToOrganization;

    /** @use HasFactory<PropertyFactory> */
    use HasFactory;

    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    /**
     * @return HasMany<Unit, $this>
     */
    public function units(): HasMany
    {
        return $this->hasMany(Unit::class);
    }

    protected function casts(): array
    {
        return [
            'type' => PropertyType::class,
            'address' => 'array',
            'custom_fields' => 'array',
            'lock_version' => 'integer',
            'archived_at' => 'datetime',
        ];
    }
}

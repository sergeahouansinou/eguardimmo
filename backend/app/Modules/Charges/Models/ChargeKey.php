<?php

declare(strict_types=1);

namespace App\Modules\Charges\Models;

use App\Modules\Charges\Enums\KeyKind;
use App\Shared\Audit\Auditable;
use App\Shared\Audit\PreciseTimestamp;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $property_id
 * @property string $label
 * @property KeyKind $kind
 * @property Carbon|null $archived_at
 * @property int $lock_version
 * @property string|null $created_by_user_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
final class ChargeKey extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'kind' => KeyKind::class,
            'archived_at' => PreciseTimestamp::class,
            'lock_version' => 'integer',
        ];
    }

    /**
     * @return list<string>
     */
    public function auditExcluded(): array
    {
        return ['label'];
    }

    /**
     * @return HasMany<ChargeKeyVersion, $this>
     */
    public function versions(): HasMany
    {
        return $this->hasMany(ChargeKeyVersion::class, 'key_id')->orderBy('valid_from')->orderBy('id');
    }
}

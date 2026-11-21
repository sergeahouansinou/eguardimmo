<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Models;

use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $feature_key
 * @property bool $enabled
 * @property int|null $limit_value
 * @property Carbon $starts_at
 * @property Carbon $ends_at
 * @property string $reason_code
 * @property string $approval_id
 * @property string|null $granted_by_user_id
 * @property Carbon|null $revoked_at
 */
final class OrganizationEntitlementOverride extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    /** @var array<string, mixed> */
    protected $attributes = ['limit_value' => null, 'revoked_at' => null, 'granted_by_user_id' => null];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'limit_value' => 'integer',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }
}

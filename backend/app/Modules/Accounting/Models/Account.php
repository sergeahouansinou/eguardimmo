<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Models;

use App\Modules\Accounting\Enums\AccountRole;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $code
 * @property string $label
 * @property AccountRole $role
 */
final class Account extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return ['role' => AccountRole::class];
    }
}

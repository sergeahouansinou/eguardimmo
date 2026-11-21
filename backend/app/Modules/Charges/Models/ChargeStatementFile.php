<?php

declare(strict_types=1);

namespace App\Modules\Charges\Models;

use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $statement_id
 * @property string $stored_file_id
 * @property string $label
 * @property bool $tenant_visible
 * @property Carbon|null $visible_until
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
final class ChargeStatementFile extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'tenant_visible' => 'boolean',
            'visible_until' => 'date:Y-m-d',
        ];
    }
}

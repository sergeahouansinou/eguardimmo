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
 * @property string $item_id
 * @property string $unit_id
 * @property int $quantity_milli
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
final class ChargeConsumption extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'quantity_milli' => 'integer',
        ];
    }
}

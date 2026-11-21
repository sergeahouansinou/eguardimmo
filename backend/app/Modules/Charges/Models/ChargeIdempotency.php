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
 * @property string $scope
 * @property string $idempotency_key
 * @property string $fingerprint
 * @property string $target_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
final class ChargeIdempotency extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $table = 'charge_idempotency';

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];
}

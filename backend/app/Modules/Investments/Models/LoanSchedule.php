<?php

declare(strict_types=1);

namespace App\Modules\Investments\Models;

use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $loan_id
 * @property int $version
 * @property Carbon $effective_from
 * @property string $reason
 */
final class LoanSchedule extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return ['effective_from' => 'date:Y-m-d', 'version' => 'integer'];
    }
}

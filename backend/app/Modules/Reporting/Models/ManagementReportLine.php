<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Models;

use App\Modules\Reporting\Enums\LineDirection;
use App\Modules\Reporting\Enums\LineKind;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $report_id
 * @property int $position
 * @property LineKind $kind
 * @property Carbon $entry_date
 * @property string|null $unit_id
 * @property string|null $lease_id
 * @property string|null $mandate_id
 * @property string $label
 * @property int $amount
 * @property LineDirection $direction
 * @property string|null $source_type
 * @property string|null $source_id
 */
final class ManagementReportLine extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'kind' => LineKind::class,
            'direction' => LineDirection::class,
            'entry_date' => 'date:Y-m-d',
            'position' => 'integer',
            'amount' => 'integer',
        ];
    }
}

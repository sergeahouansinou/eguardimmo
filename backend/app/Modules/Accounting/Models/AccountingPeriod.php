<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Models;

use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Un mois civil clos : l'absence de ligne signifie ouvert. Jamais modifié ni supprimé (déclencheurs).
 *
 * @property string $id
 * @property string $organization_id
 * @property Carbon $period_start
 * @property Carbon $period_end
 * @property Carbon $closed_at
 * @property string|null $closed_by_user_id
 * @property array<string, mixed> $closing_cutoff
 */
final class AccountingPeriod extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'period_start' => 'date:Y-m-d',
            'period_end' => 'date:Y-m-d',
            'closed_at' => 'datetime',
            'closing_cutoff' => 'array',
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Models;

use App\Modules\Maintenance\Enums\ApprovalStatus;
use App\Modules\Maintenance\Enums\DecidedVia;
use App\Shared\Audit\Auditable;
use App\Shared\Audit\PreciseTimestamp;
use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $intervention_id
 * @property string|null $quote_id
 * @property Money $amount
 * @property Money $ceiling_amount
 * @property string $currency
 * @property ApprovalStatus $status
 * @property Carbon $requested_at
 * @property Carbon $decide_before
 * @property Carbon|null $decided_at
 * @property DecidedVia|null $decided_via
 * @property string|null $decider_party_id
 * @property string|null $decided_by_user_id
 * @property string|null $comment
 * @property string|null $proof_file_id
 * @property int $lock_version
 */
final class InterventionApproval extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    /**
     * @return list<string>
     */
    public function auditMasked(): array
    {
        return ['comment'];
    }

    /**
     * @return list<string>
     */
    public function auditExcluded(): array
    {
        return ['open_of_intervention'];
    }

    protected function casts(): array
    {
        return [
            'amount' => MoneyCast::class.':currency',
            'ceiling_amount' => MoneyCast::class.':currency',
            'status' => ApprovalStatus::class,
            'requested_at' => PreciseTimestamp::class,
            'decide_before' => PreciseTimestamp::class,
            'decided_at' => PreciseTimestamp::class,
            'decided_via' => DecidedVia::class,
            'lock_version' => 'integer',
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Models;

use App\Modules\OwnerFunds\Enums\PayoutBatchStatus;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $organization_id
 * @property string|null $number
 * @property PayoutBatchStatus $status
 * @property string $currency
 * @property Carbon|null $execution_on
 * @property string $idempotency_key
 * @property string $fingerprint
 * @property int $lock_version
 * @property Carbon|null $validated_at
 * @property string|null $validated_by_user_id
 * @property bool $second_approver_required
 * @property int $approvers_count
 * @property Carbon|null $cancelled_at
 * @property string|null $cancel_reason
 * @property string|null $created_by_user_id
 * @property Carbon|null $created_at
 */
final class PayoutBatch extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    /**
     * @return list<string>
     */
    public function auditExcluded(): array
    {
        return ['lock_version', 'fingerprint', 'idempotency_key'];
    }

    /**
     * @return HasMany<PayoutItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(PayoutItem::class, 'batch_id')->orderBy('created_at')->orderBy('id');
    }

    protected function casts(): array
    {
        return [
            'status' => PayoutBatchStatus::class,
            'execution_on' => 'date:Y-m-d',
            'validated_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'lock_version' => 'integer',
            'second_approver_required' => 'boolean',
            'approvers_count' => 'integer',
        ];
    }
}

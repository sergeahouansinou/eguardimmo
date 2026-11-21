<?php

declare(strict_types=1);

namespace App\Modules\Charges\Models;

use App\Modules\Charges\Enums\StatementSettlement;
use App\Modules\Charges\Enums\StatementStatus;
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
 * @property string $exercise_id
 * @property string $lease_id
 * @property string|null $number
 * @property StatementStatus $status
 * @property int $occupied_days
 * @property Money $share_total
 * @property Money $provisions_called
 * @property Money $provisions_unpaid
 * @property Money $balance
 * @property Money $suggested_monthly_provision
 * @property string $currency
 * @property StatementSettlement|null $settlement
 * @property Carbon|null $not_before
 * @property string|null $mandate_id
 * @property string|null $mandant_party_id
 * @property array<string, mixed> $snapshot
 * @property string $fingerprint
 * @property string $template_version
 * @property string|null $issued_document_id
 * @property string|null $stored_file_id
 * @property Carbon|null $issued_at
 * @property Carbon|null $visible_until
 * @property string|null $supersedes_id
 * @property string|null $rectification_reason
 * @property string|null $failure_reason
 * @property string|null $idempotency_key
 * @property int $lock_version
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
final class ChargeStatement extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'status' => StatementStatus::class,
            'settlement' => StatementSettlement::class,
            'occupied_days' => 'integer',
            'share_total' => MoneyCast::class.':currency',
            'provisions_called' => MoneyCast::class.':currency',
            'provisions_unpaid' => MoneyCast::class.':currency',
            'balance' => MoneyCast::class.':currency',
            'suggested_monthly_provision' => MoneyCast::class.':currency',
            'not_before' => 'date:Y-m-d',
            'snapshot' => 'array',
            'issued_at' => PreciseTimestamp::class,
            'visible_until' => 'date:Y-m-d',
            'lock_version' => 'integer',
        ];
    }

    /**
     * @return list<string>
     */
    public function auditExcluded(): array
    {
        return ['snapshot', 'balance', 'share_total', 'provisions_called', 'provisions_unpaid', 'suggested_monthly_provision', 'rectification_reason', 'failure_reason', 'fingerprint', 'idempotency_key'];
    }
}

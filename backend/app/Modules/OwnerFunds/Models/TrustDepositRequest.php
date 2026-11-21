<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Models;

use App\Modules\OwnerFunds\Enums\TrustDepositStatus;
use App\Shared\Audit\Auditable;
use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * Apport demandé par un membre, écrit au grand livre seulement à la confirmation par un second membre habilité.
 *
 * @property string $id
 * @property string $organization_id
 * @property TrustDepositStatus $status
 * @property Money $amount
 * @property string $currency
 * @property Carbon $executed_on
 * @property string $bank_reference
 * @property bool $second_approver_required
 * @property int $approvers_count
 * @property string|null $requested_by_user_id
 * @property string|null $confirmed_by_user_id
 * @property Carbon|null $confirmed_at
 * @property bool $confirmed_solo
 * @property string|null $trust_transfer_id
 * @property string $idempotency_key
 * @property Carbon|null $created_at
 */
final class TrustDepositRequest extends Model
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
        return ['amount', 'bank_reference'];
    }

    /**
     * @return list<string>
     */
    public function auditExcluded(): array
    {
        return ['idempotency_key'];
    }

    protected function casts(): array
    {
        return [
            'status' => TrustDepositStatus::class,
            'amount' => MoneyCast::class.':currency',
            'executed_on' => 'date:Y-m-d',
            'confirmed_at' => 'datetime',
            'second_approver_required' => 'boolean',
            'approvers_count' => 'integer',
            'confirmed_solo' => 'boolean',
        ];
    }
}

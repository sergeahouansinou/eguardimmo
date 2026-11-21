<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Models;

use App\Modules\OwnerFunds\Enums\ExclusionReason;
use App\Modules\OwnerFunds\Enums\PayoutItemStatus;
use App\Shared\Audit\Auditable;
use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * Reversement d'un mandant dans un lot. L'IBAN n'est jamais copié : seul l'identifiant du compte et ses quatre derniers caractères.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $batch_id
 * @property string $mandant_party_id
 * @property PayoutItemStatus $status
 * @property ExclusionReason|null $exclusion_reason
 * @property Money $net_amount
 * @property Money $fees_settled_amount
 * @property string $currency
 * @property string|null $bank_account_id
 * @property string|null $bank_last4
 * @property string|null $transit_entry_id
 * @property string|null $execution_entry_id
 * @property string|null $return_entry_id
 * @property Carbon|null $executed_on
 * @property string|null $bank_reference
 * @property string|null $validated_by_user_id
 * @property string|null $executed_by_user_id
 * @property bool $executed_solo
 * @property string|null $failure_reason
 * @property int $lock_version
 * @property Carbon|null $created_at
 */
final class PayoutItem extends Model
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
        return ['net_amount', 'fees_settled_amount', 'bank_last4', 'bank_reference'];
    }

    /**
     * @return list<string>
     */
    public function auditExcluded(): array
    {
        return ['lock_version', 'open_key'];
    }

    protected function casts(): array
    {
        return [
            'status' => PayoutItemStatus::class,
            'exclusion_reason' => ExclusionReason::class,
            'net_amount' => MoneyCast::class.':currency',
            'fees_settled_amount' => MoneyCast::class.':currency',
            'executed_on' => 'date:Y-m-d',
            'executed_solo' => 'boolean',
            'lock_version' => 'integer',
        ];
    }
}

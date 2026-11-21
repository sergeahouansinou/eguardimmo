<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Models;

use App\Modules\OwnerFunds\Enums\TrustTransferDirection;
use App\Shared\Audit\Auditable;
use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * Virement entre la banque de l'agence et le compte de tiers : prélèvement des honoraires ou apport qui résorbe un écart.
 *
 * @property string $id
 * @property string $organization_id
 * @property TrustTransferDirection $direction
 * @property Money $amount
 * @property string $currency
 * @property Carbon $executed_on
 * @property string|null $bank_reference
 * @property string $ledger_entry_id
 * @property string|null $created_by_user_id
 * @property string $idempotency_key
 * @property Carbon|null $created_at
 */
final class TrustTransfer extends Model
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

    protected function casts(): array
    {
        return [
            'direction' => TrustTransferDirection::class,
            'amount' => MoneyCast::class.':currency',
            'executed_on' => 'date:Y-m-d',
        ];
    }
}

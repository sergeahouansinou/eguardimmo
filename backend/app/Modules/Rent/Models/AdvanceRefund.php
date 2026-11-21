<?php

declare(strict_types=1);

namespace App\Modules\Rent\Models;

use App\Shared\Audit\Auditable;
use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * Part d'une avance du bail rendue au locataire : une ligne par encaissement entamé, une seule écriture au grand livre.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $lease_id
 * @property string $payment_id
 * @property Money $amount
 * @property string $currency
 * @property Carbon $refunded_on
 * @property string $source
 * @property string|null $reference
 * @property string $ledger_entry_id
 * @property string $idempotency_key
 * @property string $fingerprint
 * @property string|null $recorded_by_user_id
 * @property Carbon|null $created_at
 */
final class AdvanceRefund extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $table = 'rent_advance_refunds';

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = [
        'lease_id', 'payment_id', 'amount', 'currency', 'refunded_on', 'source', 'reference', 'ledger_entry_id', 'idempotency_key',
        'fingerprint', 'recorded_by_user_id',
    ];

    /**
     * @return list<string>
     */
    public function auditMasked(): array
    {
        return ['reference'];
    }

    protected function casts(): array
    {
        return [
            'amount' => MoneyCast::class.':currency',
            'refunded_on' => 'date:Y-m-d',
        ];
    }
}

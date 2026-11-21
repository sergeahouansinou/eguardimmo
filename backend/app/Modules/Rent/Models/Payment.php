<?php

declare(strict_types=1);

namespace App\Modules\Rent\Models;

use App\Modules\Rent\Enums\PaymentMethod;
use App\Modules\Rent\Enums\PaymentStatus;
use App\Shared\Audit\Auditable;
use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * Encaissement saisi à la main sur un bail. Il ne se supprime jamais : une annulation contrepasse son écriture.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $lease_id
 * @property string|null $party_id
 * @property PaymentStatus $status
 * @property PaymentMethod $method
 * @property Money $amount
 * @property string $currency
 * @property Carbon $received_on
 * @property string|null $reference
 * @property string|null $note
 * @property string $idempotency_key
 * @property string $fingerprint
 * @property string|null $provider_reference
 * @property string|null $ledger_entry_id
 * @property Carbon|null $cancelled_on
 * @property string|null $cancellation_reason
 * @property string|null $recorded_by_user_id
 * @property Carbon|null $created_at
 */
final class Payment extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $table = 'rent_payments';

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = [
        'lease_id', 'party_id', 'status', 'method', 'amount', 'currency', 'received_on', 'reference', 'note', 'idempotency_key',
        'fingerprint', 'provider_reference', 'ledger_entry_id', 'cancelled_on', 'cancellation_reason', 'recorded_by_user_id',
    ];

    /**
     * @return list<string>
     */
    public function auditMasked(): array
    {
        return ['note', 'reference'];
    }

    /**
     * @return HasMany<PaymentAllocation, $this>
     */
    public function allocations(): HasMany
    {
        return $this->hasMany(PaymentAllocation::class);
    }

    protected function casts(): array
    {
        return [
            'status' => PaymentStatus::class,
            'method' => PaymentMethod::class,
            'amount' => MoneyCast::class.':currency',
            'received_on' => 'date:Y-m-d',
            'cancelled_on' => 'date:Y-m-d',
        ];
    }
}

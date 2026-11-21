<?php

declare(strict_types=1);

namespace App\Modules\Rent\Models;

use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * Part d'un encaissement imputée sur une échéance. `ledger_entry_id` est l'écriture qui l'a créée (celle de
 * l'encaissement, ou la reclassification d'une avance) : c'est elle que l'annulation contrepasse.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $payment_id
 * @property string $installment_id
 * @property Money $amount
 * @property string $currency
 * @property string $ledger_entry_id
 * @property Carbon|null $reversed_at
 * @property-read Payment $payment
 */
final class PaymentAllocation extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $table = 'rent_payment_allocations';

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = ['payment_id', 'installment_id', 'amount', 'currency', 'ledger_entry_id', 'reversed_at'];

    /**
     * @return BelongsTo<Payment, $this>
     */
    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    protected function casts(): array
    {
        return [
            'amount' => MoneyCast::class.':currency',
            'reversed_at' => 'datetime',
        ];
    }
}

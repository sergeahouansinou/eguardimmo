<?php

declare(strict_types=1);

namespace App\Modules\Rent\Models;

use App\Modules\Rent\Database\Factories\InstallmentFactory;
use App\Modules\Rent\Enums\InstallmentKind;
use App\Modules\Rent\Enums\InstallmentStatus;
use App\Shared\Audit\Auditable;
use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * Appel de loyer d'un bail sur [period_start, period_end] (jours compris). Les montants sont figés à la génération ;
 * le reste dû se lit dans le grand livre, jamais ici.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $lease_id
 * @property string|null $party_id
 * @property string|null $unit_id
 * @property InstallmentKind $kind
 * @property Carbon $period_start
 * @property Carbon $period_end
 * @property Carbon $due_date
 * @property InstallmentStatus $status
 * @property string $currency
 * @property Money $rent_amount
 * @property Money $charges_amount
 * @property Money $vat_amount
 * @property Money $total_amount
 * @property Carbon|null $issued_on
 * @property string|null $ledger_entry_id
 * @property Carbon|null $cancelled_on
 * @property string|null $cancellation_reason
 * @property Carbon|null $overdue_notified_at
 * @property string|null $mandate_id
 * @property string|null $mandant_party_id
 */
#[UseFactory(InstallmentFactory::class)]
final class Installment extends Model
{
    use Auditable;
    use BelongsToOrganization;

    /** @use HasFactory<InstallmentFactory> */
    use HasFactory;

    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $attributes = ['kind' => 'periodic'];

    protected $fillable = [
        'lease_id', 'kind', 'party_id', 'unit_id', 'period_start', 'period_end', 'due_date', 'status', 'currency', 'rent_amount',
        'charges_amount', 'vat_amount', 'total_amount', 'issued_on', 'ledger_entry_id', 'cancelled_on', 'cancellation_reason',
        'overdue_notified_at', 'mandate_id', 'mandant_party_id',
    ];

    /**
     * @return HasMany<InstallmentLine, $this>
     */
    public function lines(): HasMany
    {
        return $this->hasMany(InstallmentLine::class)->orderBy('position');
    }

    /**
     * @return HasOne<RentNotice, $this>
     */
    public function notice(): HasOne
    {
        return $this->hasOne(RentNotice::class);
    }

    /**
     * @return HasOne<RentReceipt, $this>
     */
    public function receipt(): HasOne
    {
        return $this->hasOne(RentReceipt::class)->whereNull('voided_at');
    }

    /**
     * @return HasMany<PaymentAllocation, $this>
     */
    public function allocations(): HasMany
    {
        return $this->hasMany(PaymentAllocation::class)->whereNull('reversed_at');
    }

    protected function casts(): array
    {
        return [
            'period_start' => 'date:Y-m-d',
            'period_end' => 'date:Y-m-d',
            'due_date' => 'date:Y-m-d',
            'kind' => InstallmentKind::class,
            'status' => InstallmentStatus::class,
            'rent_amount' => MoneyCast::class.':currency',
            'charges_amount' => MoneyCast::class.':currency',
            'vat_amount' => MoneyCast::class.':currency',
            'total_amount' => MoneyCast::class.':currency',
            'issued_on' => 'date:Y-m-d',
            'cancelled_on' => 'date:Y-m-d',
            'overdue_notified_at' => 'datetime',
        ];
    }
}

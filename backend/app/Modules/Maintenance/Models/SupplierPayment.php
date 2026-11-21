<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Models;

use App\Modules\Maintenance\Enums\SupplierPaymentMethod;
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
 * @property string $supplier_invoice_id
 * @property Money $amount
 * @property string $currency
 * @property Carbon $paid_on
 * @property SupplierPaymentMethod $method
 * @property string|null $reference
 * @property string $idempotency_key
 * @property string $fingerprint
 * @property string $ledger_entry_id
 * @property Carbon|null $cancelled_at
 * @property string|null $cancellation_entry_id
 * @property string|null $recorded_by_user_id
 * @property Carbon|null $created_at
 */
final class SupplierPayment extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'amount' => MoneyCast::class.':currency',
            'paid_on' => 'date:Y-m-d',
            'method' => SupplierPaymentMethod::class,
            'cancelled_at' => PreciseTimestamp::class,
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Models;

use App\Modules\Maintenance\Enums\AllocationTarget;
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
 * @property string $intervention_id
 * @property AllocationTarget $target
 * @property string|null $party_id
 * @property string|null $lease_id
 * @property Money $share_amount
 * @property int $wear_basis_points
 * @property Money $charged_amount
 * @property string $currency
 * @property string|null $basis_note
 * @property string $ledger_entry_id
 * @property string $idempotency_key
 * @property string $fingerprint
 * @property Carbon|null $cancelled_at
 * @property string|null $cancellation_entry_id
 * @property string|null $created_by_user_id
 * @property Carbon|null $created_at
 */
final class InvoiceAllocation extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'target' => AllocationTarget::class,
            'share_amount' => MoneyCast::class.':currency',
            'charged_amount' => MoneyCast::class.':currency',
            'wear_basis_points' => 'integer',
            'cancelled_at' => PreciseTimestamp::class,
        ];
    }
}

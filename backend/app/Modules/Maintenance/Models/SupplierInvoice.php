<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Models;

use App\Modules\Maintenance\Enums\SupplierInvoiceStatus;
use App\Shared\Audit\Auditable;
use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $intervention_id
 * @property string $supplier_party_id
 * @property string|null $billed_party_id
 * @property string $number
 * @property Carbon $invoice_on
 * @property Carbon|null $due_on
 * @property string $currency
 * @property Money $total_net
 * @property Money $total_tax
 * @property Money $total_gross
 * @property SupplierInvoiceStatus $status
 * @property string $stored_file_id
 * @property string $fingerprint
 * @property array<string, mixed> $snapshot
 * @property string $ledger_entry_id
 * @property bool $exceeds_approved_amount
 * @property string $idempotency_key
 * @property string|null $created_by_user_id
 * @property int $lock_version
 */
final class SupplierInvoice extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    /**
     * @return HasMany<SupplierInvoiceTax, $this>
     */
    public function taxes(): HasMany
    {
        return $this->hasMany(SupplierInvoiceTax::class, 'supplier_invoice_id')->orderBy('position')->orderBy('id');
    }

    /**
     * @return HasMany<InvoiceAllocation, $this>
     */
    public function allocations(): HasMany
    {
        return $this->hasMany(InvoiceAllocation::class, 'supplier_invoice_id')->orderBy('created_at')->orderBy('id');
    }

    /**
     * @return HasMany<SupplierPayment, $this>
     */
    public function payments(): HasMany
    {
        return $this->hasMany(SupplierPayment::class, 'supplier_invoice_id')->orderBy('created_at')->orderBy('id');
    }

    /**
     * @return list<string>
     */
    public function auditExcluded(): array
    {
        return ['snapshot'];
    }

    protected function casts(): array
    {
        return [
            'invoice_on' => 'date:Y-m-d',
            'due_on' => 'date:Y-m-d',
            'total_net' => MoneyCast::class.':currency',
            'total_tax' => MoneyCast::class.':currency',
            'total_gross' => MoneyCast::class.':currency',
            'status' => SupplierInvoiceStatus::class,
            'snapshot' => 'array',
            'exceeds_approved_amount' => 'boolean',
            'lock_version' => 'integer',
        ];
    }
}

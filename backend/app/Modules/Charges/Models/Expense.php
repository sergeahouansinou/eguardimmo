<?php

declare(strict_types=1);

namespace App\Modules\Charges\Models;

use App\Modules\Charges\Enums\ExpenseKind;
use App\Modules\Charges\Enums\ExpenseSettlement;
use App\Modules\Charges\Enums\ExpenseStatus;
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
 * @property string $property_id
 * @property string|null $unit_id
 * @property ExpenseKind $kind
 * @property string $category_term_id
 * @property string|null $payee_party_id
 * @property string|null $payee_label
 * @property string|null $reference
 * @property Carbon $document_on
 * @property Carbon $service_from
 * @property Carbon $service_to
 * @property string $currency
 * @property Money $total_gross
 * @property Money $tax_amount
 * @property Money $recoverable_amount
 * @property string|null $recoverable_rubric
 * @property ExpenseSettlement $settlement
 * @property Carbon|null $paid_on
 * @property string|null $mandate_id
 * @property string|null $mandant_party_id
 * @property string|null $stored_file_id
 * @property string $fingerprint
 * @property string|null $active_fingerprint
 * @property ExpenseStatus $status
 * @property string|null $cancel_reason
 * @property string|null $approved_by_user_id
 * @property string|null $ledger_entry_id
 * @property string|null $cancellation_entry_id
 * @property string $idempotency_key
 * @property int $lock_version
 * @property string|null $created_by_user_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
final class Expense extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'kind' => ExpenseKind::class,
            'settlement' => ExpenseSettlement::class,
            'status' => ExpenseStatus::class,
            'document_on' => 'date:Y-m-d',
            'service_from' => 'date:Y-m-d',
            'service_to' => 'date:Y-m-d',
            'paid_on' => 'date:Y-m-d',
            'total_gross' => MoneyCast::class.':currency',
            'tax_amount' => MoneyCast::class.':currency',
            'recoverable_amount' => MoneyCast::class.':currency',
            'lock_version' => 'integer',
        ];
    }

    /**
     * @return list<string>
     */
    public function auditExcluded(): array
    {
        return ['total_gross', 'tax_amount', 'recoverable_amount', 'payee_label', 'reference', 'cancel_reason', 'fingerprint', 'active_fingerprint', 'idempotency_key'];
    }

    /**
     * @return HasMany<ExpenseFile, $this>
     */
    public function files(): HasMany
    {
        return $this->hasMany(ExpenseFile::class, 'expense_id');
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Investments\Models;

use App\Modules\Investments\Enums\DeferralKind;
use App\Modules\Investments\Enums\InsuranceMode;
use App\Modules\Investments\Enums\LoanPurpose;
use App\Modules\Investments\Enums\LoanStatus;
use App\Modules\Investments\Enums\ScheduleSource;
use App\Shared\Audit\Auditable;
use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $property_id
 * @property string|null $unit_id
 * @property string $lender_label
 * @property string|null $contract_reference
 * @property LoanPurpose $purpose
 * @property string $currency
 * @property Money $principal
 * @property string $nominal_rate
 * @property Carbon $first_due_on
 * @property int $term_months
 * @property DeferralKind $deferral_kind
 * @property int $deferral_months
 * @property InsuranceMode $insurance_mode
 * @property string|null $insurance_rate
 * @property Money|null $insurance_amount
 * @property string|null $replaces_loan_id
 * @property ScheduleSource $schedule_source
 * @property LoanStatus $status
 * @property string|null $void_reason
 * @property Carbon|null $repaid_on
 * @property string|null $stored_file_id
 * @property string $idempotency_key
 * @property string $fingerprint
 * @property int $lock_version
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
final class Loan extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'purpose' => LoanPurpose::class,
            'deferral_kind' => DeferralKind::class,
            'insurance_mode' => InsuranceMode::class,
            'schedule_source' => ScheduleSource::class,
            'status' => LoanStatus::class,
            'first_due_on' => 'date:Y-m-d',
            'repaid_on' => 'date:Y-m-d',
            'principal' => MoneyCast::class.':currency',
            'insurance_amount' => MoneyCast::class.':currency',
            'nominal_rate' => 'decimal:5',
            'insurance_rate' => 'decimal:5',
            'term_months' => 'integer',
            'deferral_months' => 'integer',
            'lock_version' => 'integer',
        ];
    }

    /**
     * @return list<string>
     */
    public function auditExcluded(): array
    {
        return ['lender_label', 'contract_reference', 'principal', 'nominal_rate', 'insurance_rate', 'insurance_amount', 'void_reason', 'idempotency_key', 'fingerprint'];
    }
}

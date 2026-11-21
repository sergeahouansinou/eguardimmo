<?php

declare(strict_types=1);

namespace App\Modules\Banking\Models;

use App\Modules\Banking\Enums\Direction;
use App\Modules\Banking\Enums\IgnoreReason;
use App\Modules\Banking\Enums\LineState;
use App\Shared\Audit\Auditable;
use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * Ligne de relevé : pièce externe en ajout seul ; seuls l'état, le motif d'ignorance et la version changent (déclencheur).
 * Les libellés bancaires ne sont jamais journalisés (ADR 0035, décision 9).
 *
 * @property string $id
 * @property string $organization_id
 * @property string $statement_id
 * @property string $bank_account_id
 * @property int $line_number
 * @property Carbon $booking_date
 * @property Carbon|null $value_date
 * @property Direction $direction
 * @property Money $amount
 * @property string $currency
 * @property Money|null $original_amount
 * @property string|null $original_currency
 * @property bool $reversal
 * @property string|null $bank_reference
 * @property string|null $end_to_end_id
 * @property string|null $transaction_code
 * @property string $label
 * @property string|null $remittance_reference
 * @property string|null $counterparty_name
 * @property string|null $counterparty_hash
 * @property string|null $counterparty_last4
 * @property string $dedup_key
 * @property int $occurrence
 * @property LineState $state
 * @property IgnoreReason|null $ignore_reason
 * @property string|null $ignore_group_id
 * @property int $lock_version
 * @property Carbon|null $created_at
 */
final class BankStatementLine extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    /**
     * @return list<string>
     */
    public function auditExcluded(): array
    {
        return ['label', 'counterparty_name', 'remittance_reference', 'counterparty_hash', 'counterparty_last4', 'bank_reference', 'end_to_end_id', 'dedup_key'];
    }

    protected function casts(): array
    {
        return [
            'booking_date' => 'date:Y-m-d',
            'value_date' => 'date:Y-m-d',
            'direction' => Direction::class,
            'amount' => MoneyCast::class.':currency',
            'original_amount' => MoneyCast::class.':original_currency',
            'reversal' => 'boolean',
            'state' => LineState::class,
            'ignore_reason' => IgnoreReason::class,
            'line_number' => 'integer',
            'occurrence' => 'integer',
            'lock_version' => 'integer',
        ];
    }
}

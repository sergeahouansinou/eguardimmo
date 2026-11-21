<?php

declare(strict_types=1);

namespace App\Modules\Banking\Models;

use App\Modules\Banking\Enums\ReconciliationStatus;
use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * État de rapprochement d'un compte à la fin d'un mois ; immuable une fois validé (déclencheur).
 *
 * @property string $id
 * @property string $organization_id
 * @property string $bank_account_id
 * @property Carbon $as_of
 * @property string $currency
 * @property string $bank_balance_source
 * @property Money $bank_balance
 * @property string|null $balance_proof_file_id
 * @property Money $book_balance
 * @property Money $unmatched_lines_total
 * @property Money $unmatched_entries_total
 * @property Money $ignored_total
 * @property Money $timing_difference
 * @property Money $unexplained_difference
 * @property array<string, mixed> $items
 * @property string $ledger_version
 * @property ReconciliationStatus $status
 * @property string|null $validated_by_user_id
 * @property Carbon|null $validated_at
 * @property string|null $supersedes_id
 * @property string|null $created_by_user_id
 * @property Carbon|null $created_at
 */
final class BankReconciliation extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'as_of' => 'date:Y-m-d',
            'bank_balance' => MoneyCast::class.':currency',
            'book_balance' => MoneyCast::class.':currency',
            'unmatched_lines_total' => MoneyCast::class.':currency',
            'unmatched_entries_total' => MoneyCast::class.':currency',
            'ignored_total' => MoneyCast::class.':currency',
            'timing_difference' => MoneyCast::class.':currency',
            'unexplained_difference' => MoneyCast::class.':currency',
            'items' => 'array',
            'status' => ReconciliationStatus::class,
            'validated_at' => 'datetime',
        ];
    }
}

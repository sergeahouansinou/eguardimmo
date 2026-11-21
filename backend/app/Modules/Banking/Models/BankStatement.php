<?php

declare(strict_types=1);

namespace App\Modules\Banking\Models;

use App\Modules\Banking\Enums\StatementSource;
use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * Relevé importé : pièce externe en ajout seul ; seule l'annulation de l'import (`voided_at`) le modifie.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $bank_account_id
 * @property StatementSource $source
 * @property string|null $format_version
 * @property string|null $stored_file_id
 * @property string $file_sha256
 * @property string|null $statement_ref
 * @property string|null $sequence
 * @property Carbon $period_from
 * @property Carbon $period_to
 * @property Money|null $opening_balance
 * @property Money|null $closing_balance
 * @property string $currency
 * @property int $lines_total
 * @property int $lines_imported
 * @property int $lines_duplicated
 * @property int $lines_rejected
 * @property bool $is_copy
 * @property string $idempotency_key
 * @property string $fingerprint
 * @property string|null $imported_by_user_id
 * @property Carbon|null $voided_at
 * @property string|null $voided_by_user_id
 * @property string|null $void_reason
 * @property Carbon|null $created_at
 */
final class BankStatement extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'source' => StatementSource::class,
            'period_from' => 'date:Y-m-d',
            'period_to' => 'date:Y-m-d',
            'opening_balance' => MoneyCast::class.':currency',
            'closing_balance' => MoneyCast::class.':currency',
            'lines_total' => 'integer',
            'lines_imported' => 'integer',
            'lines_duplicated' => 'integer',
            'lines_rejected' => 'integer',
            'is_copy' => 'boolean',
            'voided_at' => 'datetime',
        ];
    }
}

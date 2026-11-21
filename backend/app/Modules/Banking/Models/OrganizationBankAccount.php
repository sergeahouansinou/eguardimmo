<?php

declare(strict_types=1);

namespace App\Modules\Banking\Models;

use App\Modules\Banking\Enums\AccountStatus;
use App\Modules\Banking\Enums\IdentifierKind;
use App\Modules\Banking\Enums\LedgerRole;
use App\Shared\Audit\Auditable;
use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * Compte bancaire suivi : jamais l'IBAN, seulement son empreinte HMAC et ses quatre derniers caractères (ADR 0035).
 *
 * @property string $id
 * @property string $organization_id
 * @property LedgerRole $ledger_role
 * @property string $label
 * @property string|null $bank_name
 * @property string $holder_name
 * @property IdentifierKind $identifier_kind
 * @property string $identifier_hash
 * @property string $identifier_last4
 * @property string|null $country
 * @property non-empty-string $currency
 * @property AccountStatus $status
 * @property Carbon $reconciliation_from
 * @property Money $opening_bank_balance
 * @property string|null $replaces_id
 * @property array<string, mixed>|null $csv_profile
 * @property Carbon|null $closed_at
 * @property string|null $closed_by_user_id
 * @property string|null $created_by_user_id
 * @property Carbon|null $created_at
 */
final class OrganizationBankAccount extends Model
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
        return ['identifier_hash'];
    }

    /**
     * @return list<string>
     */
    public function auditMasked(): array
    {
        return ['holder_name', 'identifier_last4', 'opening_bank_balance'];
    }

    protected function casts(): array
    {
        return [
            'ledger_role' => LedgerRole::class,
            'identifier_kind' => IdentifierKind::class,
            'status' => AccountStatus::class,
            'reconciliation_from' => 'date:Y-m-d',
            'opening_bank_balance' => MoneyCast::class.':currency',
            'csv_profile' => 'array',
            'closed_at' => 'datetime',
        ];
    }
}

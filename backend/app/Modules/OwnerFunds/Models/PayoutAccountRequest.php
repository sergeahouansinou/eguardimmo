<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Models;

use App\Modules\OwnerFunds\Enums\PayoutAccountRequestStatus;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Demande de changement d'IBAN d'un mandant : l'IBAN reste dans Parties, la demande n'en porte que la référence.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $mandant_party_id
 * @property string $access_id
 * @property string $requested_by_user_id
 * @property string $bank_account_id
 * @property string $proof_file_id
 * @property PayoutAccountRequestStatus $status
 * @property string|null $code_hash
 * @property int $code_attempts
 * @property string|null $decided_by_user_id
 * @property Carbon|null $decided_at
 * @property string|null $reject_reason
 * @property int $lock_version
 * @property Carbon|null $created_at
 */
final class PayoutAccountRequest extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    /**
     * @return list<string>
     */
    public function auditMasked(): array
    {
        return ['code_hash', 'reject_reason'];
    }

    protected function casts(): array
    {
        return [
            'status' => PayoutAccountRequestStatus::class,
            'decided_at' => 'datetime',
            'code_attempts' => 'integer',
            'lock_version' => 'integer',
        ];
    }
}

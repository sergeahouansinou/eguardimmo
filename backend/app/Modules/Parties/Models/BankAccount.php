<?php

declare(strict_types=1);

namespace App\Modules\Parties\Models;

use App\Modules\Parties\Enums\BankAccountStatus;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $party_id
 * @property string|null $iban
 * @property string|null $iban_last4
 * @property string|null $iban_hash
 * @property string|null $bic
 * @property string|null $holder_name
 * @property Carbon $valid_from
 * @property Carbon|null $valid_to
 * @property BankAccountStatus $status
 * @property Carbon|null $activated_at
 * @property Carbon|null $created_at
 */
final class BankAccount extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected $attributes = ['status' => 'active'];

    /**
     * @return list<string>
     */
    public function auditMasked(): array
    {
        return ['iban', 'iban_last4', 'iban_hash', 'bic', 'holder_name'];
    }

    protected function casts(): array
    {
        return [
            'iban' => 'encrypted',
            'valid_from' => 'date:Y-m-d',
            'valid_to' => 'date:Y-m-d',
            'status' => BankAccountStatus::class,
            'activated_at' => 'datetime',
        ];
    }
}

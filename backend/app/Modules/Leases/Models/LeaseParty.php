<?php

declare(strict_types=1);

namespace App\Modules\Leases\Models;

use App\Modules\Leases\Database\Factories\LeasePartyFactory;
use App\Modules\Leases\Enums\LeasePartyRole;
use App\Shared\Audit\Auditable;
use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * Période semi-ouverte : [valid_from, valid_to).
 *
 * @property string $id
 * @property string $organization_id
 * @property string $lease_id
 * @property string $party_id
 * @property LeasePartyRole $role
 * @property bool $joint_liability
 * @property string|null $guarantees_party_id
 * @property Money|null $guarantee_limit_amount
 * @property string|null $guarantee_currency
 * @property Carbon|null $guarantee_ends_on
 * @property Carbon $valid_from
 * @property Carbon|null $valid_to
 * @property-read Lease $lease
 */
#[UseFactory(LeasePartyFactory::class)]
final class LeaseParty extends Model
{
    use Auditable;
    use BelongsToOrganization;

    /** @use HasFactory<LeasePartyFactory> */
    use HasFactory;

    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = [
        'lease_id', 'party_id', 'role', 'joint_liability', 'guarantees_party_id', 'guarantee_limit_amount', 'guarantee_ends_on',
        'valid_from', 'valid_to',
    ];

    /**
     * @return BelongsTo<Lease, $this>
     */
    public function lease(): BelongsTo
    {
        return $this->belongsTo(Lease::class);
    }

    protected function casts(): array
    {
        return [
            'role' => LeasePartyRole::class,
            'joint_liability' => 'boolean',
            'guarantee_limit_amount' => MoneyCast::class.':guarantee_currency',
            'guarantee_ends_on' => 'date:Y-m-d',
            'valid_from' => 'date:Y-m-d',
            'valid_to' => 'date:Y-m-d',
        ];
    }
}

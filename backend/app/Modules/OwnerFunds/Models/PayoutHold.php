<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Models;

use App\Modules\OwnerFunds\Enums\HoldKind;
use App\Modules\OwnerFunds\Enums\HoldReason;
use App\Shared\Audit\Auditable;
use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * Retenue ou blocage : un paramètre, jamais un solde. Historique d'ajout seul, la levée pose `released_at`.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $mandant_party_id
 * @property HoldKind $kind
 * @property Money|null $amount
 * @property string $currency
 * @property HoldReason $reason
 * @property string|null $comment
 * @property string|null $placed_by_user_id
 * @property Carbon|null $released_at
 * @property string|null $released_by_user_id
 * @property Carbon|null $created_at
 */
final class PayoutHold extends Model
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
        return ['amount', 'comment'];
    }

    protected function casts(): array
    {
        return [
            'kind' => HoldKind::class,
            'reason' => HoldReason::class,
            'amount' => MoneyCast::class.':currency',
            'released_at' => 'datetime',
        ];
    }
}

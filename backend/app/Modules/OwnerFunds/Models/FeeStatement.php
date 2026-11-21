<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Models;

use App\Shared\Audit\Auditable;
use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * Relevé d'honoraires d'un mandat pour un mois clos : posé à la facturation, jamais modifié (triggers).
 *
 * @property string $id
 * @property string $organization_id
 * @property string $mandate_id
 * @property string $mandant_party_id
 * @property Carbon $period_start
 * @property Carbon $period_end
 * @property string $currency
 * @property Money $base_rent
 * @property Money $base_charges
 * @property string|null $fee_kind
 * @property int|null $rate_bp
 * @property int|null $flat_amount
 * @property int $minimum_amount
 * @property string|null $fee_tax_mode
 * @property list<string> $term_ids
 * @property Money $fee_net
 * @property Money $tax_amount
 * @property Money $fee_total
 * @property bool $minimum_applied
 * @property Money $carried_net
 * @property string|null $invoice_id
 * @property string|null $credit_note_id
 * @property Carbon|null $created_at
 */
final class FeeStatement extends Model
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
        return ['base_rent', 'base_charges', 'fee_net', 'tax_amount', 'fee_total', 'carried_net', 'flat_amount', 'minimum_amount'];
    }

    protected function casts(): array
    {
        return [
            'period_start' => 'date:Y-m-d',
            'period_end' => 'date:Y-m-d',
            'base_rent' => MoneyCast::class.':currency',
            'base_charges' => MoneyCast::class.':currency',
            'fee_net' => MoneyCast::class.':currency',
            'tax_amount' => MoneyCast::class.':currency',
            'fee_total' => MoneyCast::class.':currency',
            'carried_net' => MoneyCast::class.':currency',
            'term_ids' => 'array',
            'minimum_applied' => 'boolean',
        ];
    }
}

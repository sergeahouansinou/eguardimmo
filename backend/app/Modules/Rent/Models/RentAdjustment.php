<?php

declare(strict_types=1);

namespace App\Modules\Rent\Models;

use App\Modules\Rent\Enums\AdjustmentStatus;
use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * Ligne de régularisation en attente d'une échéance : facturée sur la première échéance générée dont la période
 * commence au plus tôt à `not_before`. Seuls le statut et l'échéance évoluent.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $lease_id
 * @property string $source_type
 * @property string $source_id
 * @property int $position
 * @property string $label
 * @property Money $amount
 * @property string $currency
 * @property Carbon $not_before
 * @property AdjustmentStatus $status
 * @property string|null $installment_id
 */
final class RentAdjustment extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = ['lease_id', 'source_type', 'source_id', 'position', 'label', 'amount', 'currency', 'not_before', 'status', 'installment_id'];

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'amount' => MoneyCast::class.':currency',
            'not_before' => 'date:Y-m-d',
            'status' => AdjustmentStatus::class,
        ];
    }
}

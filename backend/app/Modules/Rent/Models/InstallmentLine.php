<?php

declare(strict_types=1);

namespace App\Modules\Rent\Models;

use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * Ce qu'une composante appelle sur un tronçon d'un mois civil : libellé, jours réels et montant figés.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $installment_id
 * @property int $position
 * @property string $component_key
 * @property string $semantic
 * @property string $label
 * @property Carbon $from_date
 * @property Carbon $to_date
 * @property int $days
 * @property int $month_days
 * @property string $currency
 * @property Money $monthly_amount
 * @property Money $amount
 * @property int $vat_bp
 * @property Money $vat_amount
 */
final class InstallmentLine extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = [
        'installment_id', 'position', 'component_key', 'semantic', 'label', 'from_date', 'to_date', 'days', 'month_days',
        'currency', 'monthly_amount', 'amount', 'vat_bp', 'vat_amount',
    ];

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'from_date' => 'date:Y-m-d',
            'to_date' => 'date:Y-m-d',
            'days' => 'integer',
            'month_days' => 'integer',
            'monthly_amount' => MoneyCast::class.':currency',
            'amount' => MoneyCast::class.':currency',
            'vat_bp' => 'integer',
            'vat_amount' => MoneyCast::class.':currency',
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Investments\Models;

use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $loan_schedule_id
 * @property string $loan_id
 * @property int $position
 * @property Carbon $due_on
 * @property string $currency
 * @property Money $payment
 * @property Money $interest
 * @property Money $principal
 * @property Money $insurance
 * @property Money $outstanding_after
 */
final class LoanScheduleLine extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'due_on' => 'date:Y-m-d',
            'position' => 'integer',
            'payment' => MoneyCast::class.':currency',
            'interest' => MoneyCast::class.':currency',
            'principal' => MoneyCast::class.':currency',
            'insurance' => MoneyCast::class.':currency',
            'outstanding_after' => MoneyCast::class.':currency',
        ];
    }
}

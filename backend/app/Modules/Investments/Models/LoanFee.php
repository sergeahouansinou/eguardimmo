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
 * @property string $loan_id
 * @property string $kind
 * @property Carbon $paid_on
 * @property string $currency
 * @property Money $amount
 * @property string|null $stored_file_id
 */
final class LoanFee extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return ['paid_on' => 'date:Y-m-d', 'amount' => MoneyCast::class.':currency'];
    }
}

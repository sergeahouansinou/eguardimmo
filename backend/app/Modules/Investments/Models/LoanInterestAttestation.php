<?php

declare(strict_types=1);

namespace App\Modules\Investments\Models;

use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Money\Money;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $loan_id
 * @property int $income_year
 * @property string $currency
 * @property Money $interest
 * @property Money $insurance
 * @property Money $fees
 * @property string $stored_file_id
 */
final class LoanInterestAttestation extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'income_year' => 'integer',
            'interest' => MoneyCast::class.':currency',
            'insurance' => MoneyCast::class.':currency',
            'fees' => MoneyCast::class.':currency',
        ];
    }
}

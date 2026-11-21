<?php

declare(strict_types=1);

namespace App\Modules\Charges\Models;

use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $exercise_id
 * @property string $label
 * @property string $rubric
 * @property string|null $key_id
 * @property string|null $unit_id
 * @property Money $amount
 * @property string $currency
 * @property int $position
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
final class ChargeItem extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'amount' => MoneyCast::class.':currency',
            'position' => 'integer',
        ];
    }
}

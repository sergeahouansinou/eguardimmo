<?php

declare(strict_types=1);

namespace App\Modules\Banking\Models;

use App\Modules\Banking\Enums\MatchSide;
use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $match_id
 * @property MatchSide $side
 * @property string $ref_id
 * @property Money $amount
 * @property string $currency
 * @property Carbon|null $undone_at
 */
final class BankMatchItem extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'side' => MatchSide::class,
            'amount' => MoneyCast::class.':currency',
            'undone_at' => 'datetime',
        ];
    }
}

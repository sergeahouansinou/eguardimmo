<?php

declare(strict_types=1);

namespace App\Modules\Charges\Models;

use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $statement_id
 * @property string $item_id
 * @property string $label
 * @property string $rubric
 * @property string $split_label
 * @property int $item_amount
 * @property int $weight
 * @property int $denominator
 * @property int $days
 * @property int $share
 * @property int $position
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
final class ChargeStatementLine extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'item_amount' => 'integer',
            'weight' => 'integer',
            'denominator' => 'integer',
            'days' => 'integer',
            'share' => 'integer',
            'position' => 'integer',
        ];
    }
}

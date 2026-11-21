<?php

declare(strict_types=1);

namespace App\Modules\Charges\Models;

use App\Modules\Charges\Enums\SourceKind;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $item_id
 * @property string $exercise_id
 * @property SourceKind $source_kind
 * @property string $source_id
 * @property int $amount
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
final class ChargeItemSource extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'source_kind' => SourceKind::class,
            'amount' => 'integer',
        ];
    }
}

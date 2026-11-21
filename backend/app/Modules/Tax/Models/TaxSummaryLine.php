<?php

declare(strict_types=1);

namespace App\Modules\Tax\Models;

use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $summary_id
 * @property string|null $property_id
 * @property string $line_code
 * @property string $status
 * @property int $amount_exact
 * @property int $amount_rounded
 * @property list<array{kind: string, ref: ?string, amount: int}> $sources
 * @property int $position
 */
final class TaxSummaryLine extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return ['amount_exact' => 'integer', 'amount_rounded' => 'integer', 'sources' => 'array', 'position' => 'integer'];
    }
}

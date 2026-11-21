<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Models;

use App\Modules\Maintenance\Enums\TaxCategory;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $quote_id
 * @property int $position
 * @property string $label
 * @property int $quantity_milli
 * @property string|null $unit
 * @property int $unit_price
 * @property int $net_amount
 * @property TaxCategory $tax_category
 * @property int $tax_rate_pcm
 */
final class InterventionQuoteLine extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'tax_category' => TaxCategory::class,
            'quantity_milli' => 'integer',
            'unit_price' => 'integer',
            'net_amount' => 'integer',
            'tax_rate_pcm' => 'integer',
            'position' => 'integer',
        ];
    }
}

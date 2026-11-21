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
 * @property string $supplier_invoice_id
 * @property int $position
 * @property TaxCategory $category
 * @property int $rate_pcm
 * @property int $base_amount
 * @property int $tax_amount
 */
final class SupplierInvoiceTax extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'category' => TaxCategory::class,
            'rate_pcm' => 'integer',
            'base_amount' => 'integer',
            'tax_amount' => 'integer',
            'position' => 'integer',
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Models;

use App\Modules\Invoicing\Enums\TaxCategory;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * Montants en unités mineures de la devise de la facture ; `quantity_milli` : 1 000 = une unité.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $invoice_id
 * @property int $position
 * @property string $item_term_id
 * @property string $item_semantic
 * @property string $description
 * @property int $quantity_milli
 * @property int $unit_price
 * @property int $net_amount
 * @property TaxCategory $tax_category
 * @property string|null $tax_rate_key
 * @property int $tax_rate_pcm
 * @property string|null $credited_line_id
 */
final class InvoiceLine extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'quantity_milli' => 'integer',
            'unit_price' => 'integer',
            'net_amount' => 'integer',
            'tax_category' => TaxCategory::class,
            'tax_rate_pcm' => 'integer',
        ];
    }
}

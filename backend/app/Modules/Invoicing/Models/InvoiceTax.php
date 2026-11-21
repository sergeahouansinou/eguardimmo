<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Models;

use App\Modules\Invoicing\Enums\TaxCategory;
use App\Modules\Invoicing\Enums\TaxCode;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * Une ligne par taxe, catégorie et taux : les totaux de taxe se lisent ici, jamais en additionnant les lignes.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $invoice_id
 * @property int $position
 * @property TaxCode $tax_code
 * @property TaxCategory $category
 * @property int $rate_pcm
 * @property int $base_amount
 * @property int $tax_amount
 */
final class InvoiceTax extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'tax_code' => TaxCode::class,
            'category' => TaxCategory::class,
            'rate_pcm' => 'integer',
            'base_amount' => 'integer',
            'tax_amount' => 'integer',
        ];
    }
}

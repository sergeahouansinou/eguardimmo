<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Models;

use App\Modules\Maintenance\Enums\QuoteKind;
use App\Modules\Maintenance\Enums\QuoteStatus;
use App\Shared\Audit\Auditable;
use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $intervention_id
 * @property string $supplier_party_id
 * @property string $reference
 * @property QuoteKind $kind
 * @property QuoteStatus $status
 * @property Carbon $issued_on
 * @property Carbon|null $valid_until
 * @property Carbon|null $proposed_on
 * @property string|null $message
 * @property string $stored_file_id
 * @property Money $total_net
 * @property Money $total_tax
 * @property Money $total_gross
 * @property string $currency
 * @property string|null $created_by_user_id
 * @property int $lock_version
 */
final class InterventionQuote extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    /**
     * @return HasMany<InterventionQuoteLine, $this>
     */
    public function lines(): HasMany
    {
        return $this->hasMany(InterventionQuoteLine::class, 'quote_id')->orderBy('position')->orderBy('id');
    }

    /**
     * @return list<string>
     */
    public function auditMasked(): array
    {
        return ['message'];
    }

    protected function casts(): array
    {
        return [
            'kind' => QuoteKind::class,
            'status' => QuoteStatus::class,
            'issued_on' => 'date:Y-m-d',
            'valid_until' => 'date:Y-m-d',
            'proposed_on' => 'date:Y-m-d',
            'total_net' => MoneyCast::class.':currency',
            'total_tax' => MoneyCast::class.':currency',
            'total_gross' => MoneyCast::class.':currency',
            'lock_version' => 'integer',
        ];
    }
}

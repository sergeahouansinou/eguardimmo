<?php

declare(strict_types=1);

namespace App\Modules\Leases\Models;

use App\Modules\Leases\Database\Factories\LeaseTermFactory;
use App\Modules\Leases\Enums\TermChangeReason;
use App\Shared\Audit\Auditable;
use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * Période semi-ouverte : [valid_from, valid_to). Le loyer à une date est la somme des lignes valides.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $lease_id
 * @property string $component_term_id
 * @property Money $amount
 * @property string $currency
 * @property int $vat_bp
 * @property bool $indexed
 * @property Carbon $valid_from
 * @property Carbon|null $valid_to
 * @property TermChangeReason $reason
 * @property string|null $replaces_id
 * @property string|null $created_by_user_id
 * @property-read Lease $lease
 */
#[UseFactory(LeaseTermFactory::class)]
final class LeaseTerm extends Model
{
    use Auditable;
    use BelongsToOrganization;

    /** @use HasFactory<LeaseTermFactory> */
    use HasFactory;

    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = [
        'lease_id', 'component_term_id', 'amount', 'vat_bp', 'indexed', 'valid_from', 'valid_to', 'reason', 'replaces_id',
        'created_by_user_id',
    ];

    /**
     * @return BelongsTo<Lease, $this>
     */
    public function lease(): BelongsTo
    {
        return $this->belongsTo(Lease::class);
    }

    protected function casts(): array
    {
        return [
            'amount' => MoneyCast::class.':currency',
            'vat_bp' => 'integer',
            'indexed' => 'boolean',
            'valid_from' => 'date:Y-m-d',
            'valid_to' => 'date:Y-m-d',
            'reason' => TermChangeReason::class,
        ];
    }
}

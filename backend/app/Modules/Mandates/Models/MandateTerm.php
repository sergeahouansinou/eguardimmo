<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Models;

use App\Modules\Mandates\Database\Factories\MandateTermFactory;
use App\Modules\Mandates\Enums\FeeBase;
use App\Modules\Mandates\Enums\FeeKind;
use App\Modules\Mandates\Enums\FeeTaxMode;
use App\Modules\Mandates\Enums\TermChangeReason;
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
 * Conditions financières du mandat sur [valid_from, valid_to) : un avenant ferme la ligne et en ouvre une.
 * `open_of_mandate` est une colonne générée : jamais écrite.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $mandate_id
 * @property FeeKind $fee_kind
 * @property int|null $fee_basis_points
 * @property Money|null $fee_flat_amount
 * @property string $currency
 * @property int $payout_day
 * @property Money $works_limit_amount
 * @property FeeBase|null $fee_base
 * @property Money $fee_minimum_amount
 * @property FeeTaxMode $fee_tax_mode
 * @property int|null $letting_fee_basis_points
 * @property int|null $works_fee_basis_points
 * @property string|null $signed_file_id
 * @property Carbon $valid_from
 * @property Carbon|null $valid_to
 * @property TermChangeReason $reason
 * @property string|null $replaces_id
 * @property string|null $created_by_user_id
 * @property-read Mandate $mandate
 */
#[UseFactory(MandateTermFactory::class)]
final class MandateTerm extends Model
{
    use Auditable;
    use BelongsToOrganization;

    /** @use HasFactory<MandateTermFactory> */
    use HasFactory;

    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = [
        'mandate_id', 'fee_kind', 'fee_basis_points', 'fee_flat_amount', 'fee_base', 'fee_minimum_amount', 'fee_tax_mode', 'currency', 'payout_day', 'works_limit_amount',
        'letting_fee_basis_points', 'works_fee_basis_points', 'signed_file_id',
        'valid_from', 'valid_to', 'reason', 'replaces_id', 'created_by_user_id',
    ];

    /**
     * @return list<string>
     */
    public function auditExcluded(): array
    {
        return ['open_of_mandate'];
    }

    /**
     * @return BelongsTo<Mandate, $this>
     */
    public function mandate(): BelongsTo
    {
        return $this->belongsTo(Mandate::class);
    }

    protected function casts(): array
    {
        return [
            'fee_kind' => FeeKind::class,
            'fee_basis_points' => 'integer',
            'fee_flat_amount' => MoneyCast::class.':currency',
            'fee_base' => FeeBase::class,
            'fee_minimum_amount' => MoneyCast::class.':currency',
            'fee_tax_mode' => FeeTaxMode::class,
            'letting_fee_basis_points' => 'integer',
            'works_fee_basis_points' => 'integer',
            'payout_day' => 'integer',
            'works_limit_amount' => MoneyCast::class.':currency',
            'valid_from' => 'date:Y-m-d',
            'valid_to' => 'date:Y-m-d',
            'reason' => TermChangeReason::class,
        ];
    }
}

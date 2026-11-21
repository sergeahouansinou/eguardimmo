<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Models;

use App\Modules\Mandates\Enums\FeeBase;
use App\Modules\Mandates\Enums\FeeKind;
use App\Modules\Mandates\Enums\FeeTaxMode;
use App\Shared\Audit\Auditable;
use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * Modèle de conditions d'une organisation : il préremplit la création d'un mandat côté client, sans jamais être lu par
 * un calcul ni réécrire un mandat existant (ADR 0040). Une seule ligne par organisation.
 *
 * @property string $id
 * @property string $organization_id
 * @property FeeKind $fee_kind
 * @property int|null $fee_basis_points
 * @property Money|null $fee_flat_amount
 * @property string $currency
 * @property FeeBase $fee_base
 * @property Money $fee_minimum_amount
 * @property FeeTaxMode $fee_tax_mode
 * @property int $payout_day
 * @property Money $works_limit_amount
 * @property int|null $letting_fee_basis_points
 * @property int|null $works_fee_basis_points
 * @property int $lock_version
 * @property string|null $updated_by_user_id
 * @property Carbon $updated_at
 */
final class MandateTermDefault extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'fee_kind' => FeeKind::class,
            'fee_basis_points' => 'integer',
            'fee_flat_amount' => MoneyCast::class.':currency',
            'fee_base' => FeeBase::class,
            'fee_minimum_amount' => MoneyCast::class.':currency',
            'fee_tax_mode' => FeeTaxMode::class,
            'payout_day' => 'integer',
            'works_limit_amount' => MoneyCast::class.':currency',
            'letting_fee_basis_points' => 'integer',
            'works_fee_basis_points' => 'integer',
            'lock_version' => 'integer',
        ];
    }
}

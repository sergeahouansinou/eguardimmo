<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * Montants en unités mineures de la devise (centimes).
 *
 * @property string $id
 * @property string $plan_version_id
 * @property string $currency
 * @property int $monthly_amount
 * @property int $yearly_amount
 */
final class PlanPrice extends Model
{
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['monthly_amount' => 'integer', 'yearly_amount' => 'integer'];
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * @property string $id
 * @property string $plan_version_id
 * @property string $feature_key
 * @property bool $enabled
 * @property int|null $limit_value
 */
final class PlanEntitlement extends Model
{
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id'];

    /** @var array<string, mixed> */
    protected $attributes = ['limit_value' => null];

    protected function casts(): array
    {
        return ['enabled' => 'boolean', 'limit_value' => 'integer'];
    }
}

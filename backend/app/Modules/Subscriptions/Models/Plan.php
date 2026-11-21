<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Donnée de plateforme, hors organisation.
 *
 * @property string $id
 * @property string $code
 * @property string $name
 * @property Carbon $created_at
 * @property-read Collection<int, PlanVersion> $versions
 */
final class Plan extends Model
{
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id'];

    /**
     * @return HasMany<PlanVersion, $this>
     */
    public function versions(): HasMany
    {
        return $this->hasMany(PlanVersion::class);
    }
}

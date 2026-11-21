<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Models;

use App\Modules\Subscriptions\Enums\PlanVersionStatus;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $plan_id
 * @property int $version
 * @property PlanVersionStatus $status
 * @property int $trial_days
 * @property bool $public_signup
 * @property Carbon|null $published_at
 * @property Carbon|null $archived_at
 * @property Carbon $created_at
 * @property-read Plan $plan
 * @property-read Collection<int, PlanPrice> $prices
 * @property-read Collection<int, PlanEntitlement> $entitlements
 */
final class PlanVersion extends Model
{
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'draft_key'];

    /** @var array<string, mixed> */
    protected $attributes = [
        'published_at' => null,
        'archived_at' => null,
    ];

    /**
     * @return BelongsTo<Plan, $this>
     */
    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    /**
     * @return HasMany<PlanPrice, $this>
     */
    public function prices(): HasMany
    {
        return $this->hasMany(PlanPrice::class);
    }

    /**
     * @return HasMany<PlanEntitlement, $this>
     */
    public function entitlements(): HasMany
    {
        return $this->hasMany(PlanEntitlement::class);
    }

    public function isDraft(): bool
    {
        return $this->status === PlanVersionStatus::Draft;
    }

    protected function casts(): array
    {
        return [
            'status' => PlanVersionStatus::class,
            'public_signup' => 'boolean',
            'published_at' => 'datetime',
            'archived_at' => 'datetime',
        ];
    }
}

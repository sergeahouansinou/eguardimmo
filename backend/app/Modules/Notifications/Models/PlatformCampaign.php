<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Models;

use App\Modules\Notifications\Enums\MarketingAudience;
use App\Modules\Notifications\Enums\MarketingCategory;
use App\Modules\Notifications\Enums\MarketingChannel;
use App\Modules\Notifications\Enums\PlatformCampaignStatus;
use App\Shared\Audit\PreciseTimestamp;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Campagne émise par la plateforme, hors de toute organisation (ADR 0042).
 *
 * @property string $id
 * @property MarketingChannel $channel
 * @property MarketingCategory $category
 * @property MarketingAudience $audience
 * @property int|null $inactivity_days
 * @property list<string> $recipient_user_ids
 * @property string|null $subject
 * @property string|null $html
 * @property string|null $push_title
 * @property string|null $push_body
 * @property string|null $link
 * @property PlatformCampaignStatus $status
 * @property int $recipient_count
 * @property string $created_by_user_id
 * @property string|null $sent_by_user_id
 * @property CarbonImmutable|null $sending_started_at
 * @property CarbonImmutable|null $sent_at
 * @property int $lock_version
 * @property CarbonImmutable $created_at
 * @property-read Collection<int, PlatformCampaignImage> $images
 */
final class PlatformCampaign extends Model
{
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'status', 'recipient_count', 'sent_by_user_id', 'lock_version'];

    /**
     * @return HasMany<PlatformCampaignImage, $this>
     */
    public function images(): HasMany
    {
        return $this->hasMany(PlatformCampaignImage::class, 'campaign_id')->orderBy('id');
    }

    protected function casts(): array
    {
        return [
            'channel' => MarketingChannel::class,
            'category' => MarketingCategory::class,
            'audience' => MarketingAudience::class,
            'status' => PlatformCampaignStatus::class,
            'inactivity_days' => 'integer',
            'recipient_user_ids' => 'array',
            'recipient_count' => 'integer',
            'lock_version' => 'integer',
            'sending_started_at' => PreciseTimestamp::class,
            'sent_at' => PreciseTimestamp::class,
            'created_at' => 'immutable_datetime',
        ];
    }
}

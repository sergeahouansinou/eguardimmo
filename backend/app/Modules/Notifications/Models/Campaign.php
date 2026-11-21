<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Models;

use App\Modules\Notifications\Enums\CampaignAudience;
use App\Modules\Notifications\Enums\CampaignStatus;
use App\Shared\Audit\PreciseTimestamp;
use App\Shared\Tenancy\BelongsToOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $subject
 * @property string $body
 * @property CampaignAudience $audience
 * @property list<string> $building_ids
 * @property CampaignStatus $status
 * @property bool $copy_to_history
 * @property CarbonImmutable|null $scheduled_at
 * @property CarbonImmutable|null $sending_started_at
 * @property CarbonImmutable|null $sent_at
 * @property CarbonImmutable|null $cancelled_at
 * @property CarbonImmutable|null $content_purged_at
 * @property string $created_by_user_id
 * @property string|null $sent_by_user_id
 * @property int $recipient_count
 * @property int $failed_count
 * @property int $lock_version
 * @property CarbonImmutable $created_at
 * @property CarbonImmutable $updated_at
 * @property-read Collection<int, CampaignAttachment> $attachments
 */
final class Campaign extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id', 'status', 'sent_by_user_id', 'lock_version', 'recipient_count', 'failed_count', 'content_purged_at'];

    /**
     * @return HasMany<CampaignAttachment, $this>
     */
    public function attachments(): HasMany
    {
        return $this->hasMany(CampaignAttachment::class)->orderBy('position');
    }

    /**
     * @return HasMany<CampaignDelivery, $this>
     */
    public function deliveries(): HasMany
    {
        return $this->hasMany(CampaignDelivery::class);
    }

    protected function casts(): array
    {
        return [
            'audience' => CampaignAudience::class,
            'status' => CampaignStatus::class,
            'building_ids' => 'array',
            'copy_to_history' => 'boolean',
            'scheduled_at' => PreciseTimestamp::class,
            'sending_started_at' => PreciseTimestamp::class,
            'sent_at' => PreciseTimestamp::class,
            'cancelled_at' => PreciseTimestamp::class,
            'content_purged_at' => PreciseTimestamp::class,
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }
}

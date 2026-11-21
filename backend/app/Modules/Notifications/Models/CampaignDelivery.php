<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Models;

use App\Modules\Notifications\Enums\DeliveryStatus;
use App\Shared\Audit\PreciseTimestamp;
use App\Shared\Tenancy\BelongsToOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * L'adresse et les valeurs de fusion sont chiffrées, jamais journalisées ni renvoyées par une ressource ; elles disparaissent à la purge.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $campaign_id
 * @property string $party_id
 * @property string|null $user_id
 * @property string|null $lease_id
 * @property string|null $email
 * @property string|null $email_hash
 * @property array<string, string>|null $merge_values
 * @property DeliveryStatus $status
 * @property string|null $provider_message_id
 * @property CarbonImmutable|null $attempted_at
 * @property CarbonImmutable|null $sent_at
 * @property CarbonImmutable|null $bounced_at
 * @property CarbonImmutable|null $unsubscribed_at
 * @property CarbonImmutable|null $read_at
 * @property string|null $error_code
 * @property CarbonImmutable $created_at
 * @property-read Campaign $campaign
 */
final class CampaignDelivery extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected $hidden = ['email', 'email_hash', 'merge_values'];

    /**
     * @return BelongsTo<Campaign, $this>
     */
    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }

    protected function casts(): array
    {
        return [
            'email' => 'encrypted',
            'merge_values' => 'encrypted:array',
            'status' => DeliveryStatus::class,
            'attempted_at' => PreciseTimestamp::class,
            'sent_at' => PreciseTimestamp::class,
            'bounced_at' => PreciseTimestamp::class,
            'unsubscribed_at' => PreciseTimestamp::class,
            'read_at' => PreciseTimestamp::class,
            'created_at' => 'immutable_datetime',
        ];
    }
}

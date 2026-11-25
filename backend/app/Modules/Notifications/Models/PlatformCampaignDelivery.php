<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Models;

use App\Modules\Notifications\Enums\PlatformDeliveryStatus;
use App\Shared\Audit\PreciseTimestamp;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * Aucune adresse n'est copiée : l'empreinte seule sert à rapprocher les retours du fournisseur.
 *
 * @property string $id
 * @property string $campaign_id
 * @property string $user_id
 * @property string|null $email_hash
 * @property PlatformDeliveryStatus $status
 * @property string|null $provider_message_id
 * @property CarbonImmutable|null $attempted_at
 * @property CarbonImmutable|null $sent_at
 * @property CarbonImmutable|null $bounced_at
 * @property CarbonImmutable|null $unsubscribed_at
 * @property string|null $error_code
 */
final class PlatformCampaignDelivery extends Model
{
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'status' => PlatformDeliveryStatus::class,
            'attempted_at' => PreciseTimestamp::class,
            'sent_at' => PreciseTimestamp::class,
            'bounced_at' => PreciseTimestamp::class,
            'unsubscribed_at' => PreciseTimestamp::class,
        ];
    }
}

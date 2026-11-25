<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Models;

use App\Modules\Notifications\Enums\NotificationChannel;
use App\Modules\Notifications\Enums\NotificationType;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * Une ligne = un canal coupé pour tous les comptes (ADR 0042) ; un canal verrouillé ne s'y coupe jamais.
 *
 * @property string $id
 * @property NotificationType $type
 * @property NotificationChannel $channel
 */
final class NotificationPlatformSetting extends Model
{
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['type' => NotificationType::class, 'channel' => NotificationChannel::class];
    }
}

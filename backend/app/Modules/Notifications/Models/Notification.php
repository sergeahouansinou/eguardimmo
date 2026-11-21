<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Models;

use App\Modules\Notifications\Database\Factories\NotificationFactory;
use App\Modules\Notifications\Enums\NotificationAudience;
use App\Modules\Notifications\Enums\NotificationType;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Appartient à un compte, pas à une organisation : la visibilité se calcule à la lecture (ADR 0027).
 *
 * @property string $id
 * @property string $user_id
 * @property string|null $organization_id
 * @property NotificationAudience $audience
 * @property NotificationType $type
 * @property string $dedup_key
 * @property string $title
 * @property string $body
 * @property string|null $link
 * @property string|null $lease_id
 * @property string|null $party_id
 * @property bool $in_app
 * @property bool $email
 * @property bool $push
 * @property CarbonImmutable|null $read_at
 * @property CarbonImmutable|null $archived_at
 * @property CarbonImmutable|null $emailed_at
 * @property CarbonImmutable|null $pushed_at
 * @property CarbonImmutable $created_at
 */
#[UseFactory(NotificationFactory::class)]
final class Notification extends Model
{
    /** @use HasFactory<NotificationFactory> */
    use HasFactory;

    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'audience' => NotificationAudience::class,
            'type' => NotificationType::class,
            'in_app' => 'boolean',
            'email' => 'boolean',
            'push' => 'boolean',
            'read_at' => 'immutable_datetime',
            'archived_at' => 'immutable_datetime',
            'emailed_at' => 'immutable_datetime',
            'pushed_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
        ];
    }
}

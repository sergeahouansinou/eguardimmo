<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Resources\Console;

use App\Modules\Notifications\Enums\NotificationChannel;
use App\Modules\Notifications\Enums\NotificationType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property array{type: NotificationType, cut: list<string>} $resource
 */
final class PlatformNotificationTypeResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $type = $this->resource['type'];

        return [
            'type' => $type->value,
            'label' => $type->label(),
            'group' => $type->group(),
            'audience' => $type->audience()->value,
            'audience_label' => $type->audience()->label(),
            'channels' => array_map(fn (NotificationChannel $canal): array => [
                'channel' => $canal->value,
                'label' => $canal->label(),
                'enabled' => in_array($canal, $type->locked(), true) || ! in_array($canal->value, $this->resource['cut'], true),
                'locked' => in_array($canal, $type->locked(), true),
                'default' => in_array($canal, $type->defaults(), true),
            ], NotificationChannel::cases()),
        ];
    }
}

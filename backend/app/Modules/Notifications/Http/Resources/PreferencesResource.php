<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Resources;

use App\Modules\Notifications\Enums\NotificationChannel;
use App\Modules\Notifications\Enums\NotificationType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property list<array{type: NotificationType, channels: list<array{channel: NotificationChannel, enabled: bool, locked: bool}>}> $resource
 */
final class PreferencesResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'types' => array_map(fn (array $ligne): array => [
                'type' => $ligne['type']->value,
                'label' => $ligne['type']->label(),
                'group' => $ligne['type']->group(),
                'audience' => $ligne['type']->audience()->value,
                'channels' => array_map(fn (array $canal): array => [
                    'channel' => $canal['channel']->value,
                    'label' => $canal['channel']->label(),
                    'enabled' => $canal['enabled'],
                    'locked' => $canal['locked'],
                ], $ligne['channels']),
            ], $this->resource),
        ];
    }
}

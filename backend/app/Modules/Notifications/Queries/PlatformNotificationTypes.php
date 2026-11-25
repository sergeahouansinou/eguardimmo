<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Queries;

use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Models\NotificationPlatformSetting;

/**
 * Notifications que la console règle pour tous les comptes, et leurs canaux coupés.
 */
final class PlatformNotificationTypes
{
    /**
     * @return list<array{type: NotificationType, cut: list<string>}>
     */
    public function all(): array
    {
        $coupes = [];

        foreach (NotificationPlatformSetting::query()->get() as $ligne) {
            $coupes[$ligne->type->value][] = $ligne->channel->value;
        }

        return array_map(fn (NotificationType $type): array => ['type' => $type, 'cut' => $coupes[$type->value] ?? []], NotificationType::configurable());
    }

    /**
     * @return list<string> canaux coupés pour ce type
     */
    public function cutChannels(NotificationType $type): array
    {
        return array_values(NotificationPlatformSetting::query()->where('type', $type->value)->get()
            ->map(fn (NotificationPlatformSetting $ligne): string => $ligne->channel->value)->all());
    }
}

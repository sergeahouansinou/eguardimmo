<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Queries;

use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\NotificationPreference;
use App\Modules\Notifications\Models\PushToken;
use App\Shared\Privacy\ExportSection;

/**
 * Notifications, préférences et appareils d'un compte pour un export de données personnelles : jamais le jeton d'un appareil.
 */
final readonly class AccountNotificationExport
{
    public function forAccount(string $userId): ExportSection
    {
        return new ExportSection('notifications', [
            'notifications' => Notification::query()->where('user_id', $userId)->orderBy('created_at')->get()
                ->map(fn (Notification $n): array => [
                    'type' => $n->type->value,
                    'title' => $n->title,
                    'body' => $n->body,
                    'created_at' => $n->created_at->toIso8601String(),
                    'read_at' => $n->read_at?->toIso8601String(),
                ])->all(),
            'preferences' => NotificationPreference::query()->where('user_id', $userId)->get()
                ->map(fn (NotificationPreference $p): array => ['type' => $p->type->value, 'channel' => $p->channel->value, 'enabled' => $p->enabled])->all(),
            'devices' => PushToken::query()->where('user_id', $userId)->get()
                ->map(fn (PushToken $t): array => [
                    'platform' => $t->platform->value,
                    'name' => $t->device_name,
                    'registered_at' => $t->created_at->toIso8601String(),
                    'revoked' => $t->revoked_at !== null,
                ])->all(),
        ]);
    }
}

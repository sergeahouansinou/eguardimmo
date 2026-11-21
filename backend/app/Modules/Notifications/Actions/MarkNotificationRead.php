<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Notifications\Enums\ErrorCode;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Queries\VisibleNotifications;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

final readonly class MarkNotificationRead
{
    public function __construct(private VisibleNotifications $visibles) {}

    /**
     * Rejouable. Une notification d'un autre compte, d'une organisation quittée ou inconnue répond la même 404.
     */
    public function handle(string $userId, string $notificationId): Notification
    {
        $notification = Str::isUuid($notificationId) ? $this->visibles->for($userId)->whereKey($notificationId)->first() : null;

        if ($notification === null) {
            throw ErrorCode::NotificationNotFound->problem();
        }

        if ($notification->read_at === null) {
            $notification->read_at = CarbonImmutable::now();
            $notification->save();
        }

        return $notification;
    }
}

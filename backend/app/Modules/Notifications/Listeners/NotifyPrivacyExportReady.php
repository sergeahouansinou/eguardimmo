<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use App\Modules\Privacy\Events\PrivacyExportReady;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyPrivacyExportReady implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(PrivacyExportReady $e): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::AccountExportReady,
            null,
            "privacy:{$e->requestId}:export",
            subjectId: $e->requestId,
            recipientId: $e->requesterUserId,
        ));
    }
}

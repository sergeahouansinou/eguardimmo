<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use App\Modules\Privacy\Events\PrivacyRequestCompleted;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyPrivacyRequestCompleted implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(PrivacyRequestCompleted $e): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::AccountPrivacyCompleted,
            null,
            "privacy:{$e->requestId}:completed",
            subjectId: $e->requestId,
            recipientId: $e->requesterUserId,
        ));
    }
}

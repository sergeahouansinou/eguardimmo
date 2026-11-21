<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Leases\Events\NoticeRequested;
use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyNoticeRequested implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(NoticeRequested $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::LeasesNoticeRequested,
            $evenement->organizationId,
            "notice_request:{$evenement->requestId}",
            leaseId: $evenement->leaseId,
            subjectId: $evenement->requestId,
        ));
    }
}

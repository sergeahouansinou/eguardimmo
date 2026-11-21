<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Leases\Events\NoticeRequestUnacknowledged;
use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyNoticeRequestUnacknowledged implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(NoticeRequestUnacknowledged $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::LeasesNoticeUnacknowledged,
            $evenement->organizationId,
            "notice_request:{$evenement->requestId}:late",
            leaseId: $evenement->leaseId,
            subjectId: $evenement->requestId,
        ));
    }
}

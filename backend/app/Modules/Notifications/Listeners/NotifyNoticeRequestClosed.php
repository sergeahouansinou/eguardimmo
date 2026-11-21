<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Leases\Events\NoticeRequestClosed;
use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyNoticeRequestClosed implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(NoticeRequestClosed $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::TenantNoticeClosed,
            $evenement->organizationId,
            "notice_request:{$evenement->requestId}:{$evenement->outcome->value}",
            leaseId: $evenement->leaseId,
            subjectId: $evenement->requestId,
            partyId: $evenement->partyId,
        ));
    }
}

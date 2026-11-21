<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use App\Modules\Rent\Events\NoticeIssued;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyNoticeIssued implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(NoticeIssued $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::TenantNoticeIssued,
            $evenement->organizationId,
            "notice:{$evenement->installmentId}",
            ['date' => $evenement->dueDate],
            $evenement->leaseId,
        ));
    }
}

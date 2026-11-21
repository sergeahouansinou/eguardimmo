<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use App\Modules\Reporting\Events\ManagementReportPublished;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyReportPublished implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(ManagementReportPublished $evenement): void
    {
        if (! $evenement->notify) {
            return;
        }

        $this->notifications->handle(new NotificationInput(
            NotificationType::OwnerReportPublished,
            $evenement->organizationId,
            "report:{$evenement->reportId}",
            [],
            null,
            $evenement->reportId,
            $evenement->mandantPartyId,
        ));
    }
}

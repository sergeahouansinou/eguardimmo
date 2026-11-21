<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use App\Modules\Reporting\Events\ReportsDue;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyReportsDue implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(ReportsDue $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::ReportingReportsDue,
            $evenement->organizationId,
            "due:{$evenement->mandantPartyId}:{$evenement->periodStart}",
            ['date' => $evenement->periodStart],
            null,
            null,
        ));
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Leases\Events\NoticeRequestAcknowledged;
use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * Ni motif ni date dans le texte : seule la fiche déclarante est prévenue, jamais ses colocataires.
 */
final class NotifyNoticeRequestAcknowledged implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(NoticeRequestAcknowledged $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::TenantNoticeAcknowledged,
            $evenement->organizationId,
            "notice_request:{$evenement->requestId}:acknowledged",
            leaseId: $evenement->leaseId,
            subjectId: $evenement->requestId,
            partyId: $evenement->partyId,
        ));
    }
}

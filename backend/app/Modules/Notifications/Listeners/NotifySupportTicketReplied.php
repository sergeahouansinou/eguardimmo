<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Messaging\Events\SupportTicketReplied;
use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * Prévient le seul demandeur, sans organisation : la clé porte sa dernière lecture, donc une notification par demande tant qu'il n'a pas lu.
 */
final class NotifySupportTicketReplied implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(SupportTicketReplied $e): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::AccountSupportReplied,
            null,
            "ticket:{$e->ticketId}",
            subjectId: $e->ticketId,
            readMarkers: [$e->requesterUserId => $e->readMarker],
            recipientId: $e->requesterUserId,
        ));
    }
}

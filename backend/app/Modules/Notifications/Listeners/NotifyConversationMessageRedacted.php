<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Messaging\Events\ConversationMessageRedacted;
use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * Prévient le seul auteur d'un message retiré par l'organisation, sans le texte ni le motif.
 */
final class NotifyConversationMessageRedacted implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(ConversationMessageRedacted $e): void
    {
        $type = match ($e->authorSide) {
            'tenant' => NotificationType::TenantMessageRedacted,
            'owner' => NotificationType::OwnerMessageRedacted,
            default => NotificationType::MessagingMessageRedacted,
        };

        $this->notifications->handle(new NotificationInput(
            $type,
            $e->organizationId,
            "conversation:{$e->conversationId}:redacted:{$e->messageId}",
            leaseId: $e->authorSide === 'tenant' ? $e->leaseId : null,
            subjectId: $e->conversationId,
            partyId: $e->authorSide === 'staff' ? null : $e->partyId,
            recipientId: $e->authorUserId,
        ));
    }
}

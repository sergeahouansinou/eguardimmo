<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Messaging\Events\ConversationMessagePosted;
use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * Une notification par fil et par destinataire tant qu'il ne l'a pas lu : la clé porte sa dernière lecture, jamais le texte du message.
 * L'auteur ne se notifie pas, et un message de l'équipe ne prévient pas l'équipe.
 */
final class NotifyConversationMessagePosted implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(ConversationMessagePosted $evenement): void
    {
        $entree = $evenement->authorSide === 'staff' ? $this->versContrepartie($evenement) : $this->versEquipe($evenement);

        $this->notifications->handle($entree);
    }

    private function versEquipe(ConversationMessagePosted $e): NotificationInput
    {
        return new NotificationInput(
            NotificationType::MessagingMessageReceived,
            $e->organizationId,
            "conversation:{$e->conversationId}",
            subjectId: $e->conversationId,
            assigneeId: $e->assigneeUserId,
            readMarkers: $e->readMarkers,
        );
    }

    private function versContrepartie(ConversationMessagePosted $e): NotificationInput
    {
        return new NotificationInput(
            $e->kind === 'tenant' ? NotificationType::TenantMessageReceived : NotificationType::OwnerMessageReceived,
            $e->organizationId,
            "conversation:{$e->conversationId}",
            leaseId: $e->kind === 'tenant' ? $e->leaseId : null,
            subjectId: $e->conversationId,
            partyId: $e->partyId,
            readMarkers: $e->readMarkers,
        );
    }
}

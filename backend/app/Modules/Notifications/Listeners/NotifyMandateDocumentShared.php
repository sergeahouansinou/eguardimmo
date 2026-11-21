<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Mandates\Events\MandateDocumentShared;
use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyMandateDocumentShared implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(MandateDocumentShared $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::OwnerDocumentShared,
            $evenement->organizationId,
            "mandate_document:{$evenement->documentId}",
            subjectId: $evenement->documentId,
            partyId: $evenement->mandantPartyId,
        ));
    }
}

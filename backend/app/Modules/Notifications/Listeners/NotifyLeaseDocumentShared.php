<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Leases\Events\LeaseDocumentShared;
use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyLeaseDocumentShared implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(LeaseDocumentShared $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::TenantDocumentShared,
            $evenement->organizationId,
            "lease_document:{$evenement->documentId}",
            leaseId: $evenement->leaseId,
            subjectId: $evenement->documentId,
            partyId: $evenement->partyId,
        ));
    }
}

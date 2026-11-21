<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use App\Modules\Rent\Events\ReceiptIssued;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyReceiptIssued implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(ReceiptIssued $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::TenantReceiptIssued,
            $evenement->organizationId,
            "receipt:{$evenement->receiptId}",
            [],
            $evenement->leaseId,
        ));
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use App\Modules\Rent\Events\PaymentCancelled;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyPaymentCancelled implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(PaymentCancelled $evenement): void
    {
        foreach ([NotificationType::RentPaymentCancelled, NotificationType::TenantPaymentCancelled] as $type) {
            $this->notifications->handle(new NotificationInput(
                $type,
                $evenement->organizationId,
                "payment_cancelled:{$evenement->paymentId}",
                [],
                $evenement->leaseId,
            ));
        }
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use App\Modules\Rent\Events\PaymentRecorded;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyPaymentRecorded implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(PaymentRecorded $evenement): void
    {
        foreach ([NotificationType::RentPaymentRecorded, NotificationType::TenantPaymentRecorded] as $type) {
            $this->notifications->handle(new NotificationInput(
                $type,
                $evenement->organizationId,
                "payment_recorded:{$evenement->paymentId}",
                [],
                $evenement->leaseId,
            ));
        }
    }
}

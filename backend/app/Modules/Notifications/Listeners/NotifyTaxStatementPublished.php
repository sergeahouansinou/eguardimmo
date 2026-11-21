<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Listeners;

use App\Modules\Notifications\Actions\CreateNotifications;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use App\Modules\Tax\Events\TaxStatementPublished;
use Illuminate\Contracts\Queue\ShouldQueue;

final class NotifyTaxStatementPublished implements ShouldQueue
{
    use RetriesWithBackoff;

    public function __construct(private readonly CreateNotifications $notifications) {}

    public function handle(TaxStatementPublished $evenement): void
    {
        $this->notifications->handle(new NotificationInput(
            NotificationType::OwnerTaxStatementPublished,
            $evenement->organizationId,
            "tax_statement:{$evenement->summaryId}",
            [],
            null,
            $evenement->summaryId,
            $evenement->mandantPartyId,
        ));
    }
}

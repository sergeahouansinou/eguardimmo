<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Jobs;

use App\Modules\Notifications\Actions\DeliverNotificationPush;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;

final class DeliverPush implements ShouldQueue
{
    use Dispatchable;
    use Queueable;

    public int $tries = 2;

    public function __construct(public readonly string $notificationId) {}

    public function handle(DeliverNotificationPush $envoi): void
    {
        $envoi->handle($this->notificationId);
    }
}

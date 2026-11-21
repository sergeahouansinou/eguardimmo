<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Jobs;

use App\Modules\Notifications\Actions\DeliverNotificationEmail;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Support\Facades\Log;
use Throwable;

final class DeliverEmail implements ShouldQueue
{
    use Dispatchable;
    use Queueable;
    use RetriesWithBackoff;

    public function __construct(public readonly string $notificationId) {}

    public function handle(DeliverNotificationEmail $envoi): void
    {
        $envoi->handle($this->notificationId);
    }

    public function failed(Throwable $erreur): void
    {
        Log::error('Envoi de l\'e-mail de notification abandonné après épuisement des tentatives', ['notification_id' => $this->notificationId]);
    }
}

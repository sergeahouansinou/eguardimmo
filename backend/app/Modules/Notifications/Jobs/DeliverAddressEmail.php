<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Jobs;

use App\Modules\Notifications\Mail\NotificationMail;
use App\Modules\Notifications\Support\RetriesWithBackoff;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

final class DeliverAddressEmail implements ShouldQueue
{
    use Dispatchable;
    use Queueable;
    use RetriesWithBackoff;

    public function __construct(
        public readonly string $address,
        public readonly string $title,
        public readonly string $body,
        public readonly ?string $link,
    ) {}

    public function handle(): void
    {
        Mail::to($this->address)->send(new NotificationMail($this->title, $this->body, $this->link));
    }

    public function failed(Throwable $erreur): void
    {
        Log::error('Envoi de l\'alerte à l\'adresse principale de la fiche abandonné après épuisement des tentatives');
    }
}

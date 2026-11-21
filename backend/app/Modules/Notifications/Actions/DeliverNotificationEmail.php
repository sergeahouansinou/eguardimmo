<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Notifications\Enums\NotificationAudience;
use App\Modules\Notifications\Mail\NotificationMail;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Support\AppLinks;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Mail;

final readonly class DeliverNotificationEmail
{
    public function __construct(
        private AppLinks $liens,
        private MandateDirectory $mandats,
    ) {}

    /**
     * Idempotent : `emailed_at` n'est posé qu'après l'envoi, un message déjà parti ne repart pas. Seule une adresse vérifiée reçoit, et un
     * mandant dont l'accès est révoqué ou la fenêtre échue (ADR 0032) ne reçoit plus rien, même d'une notification créée avant.
     */
    public function handle(string $notificationId): void
    {
        $notification = Notification::query()->find($notificationId);

        if ($notification === null || ! $notification->email || $notification->emailed_at !== null) {
            return;
        }

        $compte = User::query()->find($notification->user_id);

        if ($compte === null || $compte->email_verified_at === null) {
            return;
        }

        if ($notification->audience === NotificationAudience::Owner && ! $this->fenetreOuverte($notification)) {
            return;
        }

        Mail::to($compte->email)->send(new NotificationMail($notification->title, $notification->body, $this->liens->absolute($notification)));

        $notification->emailed_at = CarbonImmutable::now();
        $notification->save();
    }

    private function fenetreOuverte(Notification $notification): bool
    {
        foreach ($this->mandats->visibleToOwner($notification->user_id, $notification->organization_id) as $visible) {
            if ($visible->mandantPartyId === $notification->party_id) {
                return true;
            }
        }

        return false;
    }
}

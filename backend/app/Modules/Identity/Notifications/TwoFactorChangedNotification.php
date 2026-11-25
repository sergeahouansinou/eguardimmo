<?php

declare(strict_types=1);

namespace App\Modules\Identity\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

final class TwoFactorChangedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly bool $enabled, public readonly bool $replaced = false) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Double authentification modifiée')
            ->line(match (true) {
                $this->replaced => 'Le secret de double authentification de votre compte eGuardImmo vient d\'être remplacé.',
                $this->enabled => 'La double authentification vient d\'être activée sur votre compte eGuardImmo.',
                default => 'La double authentification vient d\'être désactivée sur votre compte eGuardImmo.',
            })
            ->line('Vos autres sessions et appareils ont été déconnectés.')
            ->line('Si vous n\'êtes pas à l\'origine de ce changement, réinitialisez votre mot de passe immédiatement.');
    }
}

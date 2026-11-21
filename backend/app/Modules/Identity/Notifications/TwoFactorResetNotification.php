<?php

declare(strict_types=1);

namespace App\Modules\Identity\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

final class TwoFactorResetNotification extends Notification implements ShouldQueue
{
    use Queueable;

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
            ->subject('Double authentification réinitialisée')
            ->line('L\'équipe eGuardImmo vient de réinitialiser la double authentification de votre compte, après vérification de votre identité.')
            ->line('Toutes vos sessions et appareils ont été déconnectés. Reconnectez-vous puis réactivez la double authentification.')
            ->line('Si vous n\'êtes pas à l\'origine de cette demande, changez votre mot de passe immédiatement et contactez le support.');
    }
}

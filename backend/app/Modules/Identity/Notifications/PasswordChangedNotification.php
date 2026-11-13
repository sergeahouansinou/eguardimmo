<?php

declare(strict_types=1);

namespace App\Modules\Identity\Notifications;

use App\Modules\Identity\Support\Hub;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

final class PasswordChangedNotification extends Notification implements ShouldQueue
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
            ->subject('Votre mot de passe a été modifié')
            ->line('Le mot de passe de votre compte eGuardImmo vient d\'être modifié. Vos autres sessions et appareils ont été déconnectés.')
            ->line('Si vous n\'êtes pas à l\'origine de ce changement, réinitialisez votre mot de passe immédiatement.')
            ->action('Réinitialiser mon mot de passe', Hub::url('/mot-de-passe-oublie'));
    }
}

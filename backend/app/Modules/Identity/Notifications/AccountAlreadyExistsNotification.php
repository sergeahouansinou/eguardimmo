<?php

declare(strict_types=1);

namespace App\Modules\Identity\Notifications;

use App\Modules\Identity\Support\Hub;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

final class AccountAlreadyExistsNotification extends Notification implements ShouldQueue
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
            ->subject('Un compte existe déjà avec cette adresse')
            ->line('Quelqu\'un a tenté de créer un compte eGuardImmo avec votre adresse e-mail, qui a déjà un compte.')
            ->line('Si c\'était vous, connectez-vous ou réinitialisez votre mot de passe.')
            ->action('Se connecter', Hub::url('/connexion'))
            ->line('Sinon, vous pouvez ignorer ce message.');
    }
}

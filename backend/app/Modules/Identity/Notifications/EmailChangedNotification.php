<?php

declare(strict_types=1);

namespace App\Modules\Identity\Notifications;

use App\Modules\Identity\Support\Hub;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Part vers l'ancienne adresse : si le compte est détourné, son titulaire légitime le sait.
 */
final class EmailChangedNotification extends Notification implements ShouldQueue
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
            ->subject('L\'adresse e-mail de votre compte a été modifiée')
            ->line('L\'adresse e-mail de votre compte eGuardImmo vient d\'être remplacée. Vos autres sessions et appareils ont été déconnectés.')
            ->line('Si vous n\'êtes pas à l\'origine de ce changement, contactez le support immédiatement.')
            ->action('Contacter le support', Hub::url('/support'));
    }
}

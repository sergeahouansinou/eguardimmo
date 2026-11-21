<?php

declare(strict_types=1);

namespace App\Modules\Operations\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Alerte sans contenu : ni sujet, ni motif, ni nom d'opérateur.
 */
final class ApprovalPendingNotification extends Notification implements ShouldQueue
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
            ->subject('Demande de validation en attente')
            ->line('Une demande de double validation attend un second opérateur dans la console eGuardImmo.')
            ->line('Ouvrez la console pour la traiter.');
    }
}

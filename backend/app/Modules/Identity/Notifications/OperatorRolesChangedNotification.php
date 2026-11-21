<?php

declare(strict_types=1);

namespace App\Modules\Identity\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

final class OperatorRolesChangedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly string $granteeEmail) {}

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
            ->subject('Rôles opérateur modifiés')
            ->line('Les rôles de l\'opérateur '.$this->granteeEmail.' dans la console eGuardImmo viennent d\'être modifiés.')
            ->line('Si ce changement n\'est pas prévu, signalez-le immédiatement.');
    }
}

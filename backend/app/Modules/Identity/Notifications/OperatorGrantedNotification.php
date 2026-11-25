<?php

declare(strict_types=1);

namespace App\Modules\Identity\Notifications;

use App\Shared\Mail\MailText;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

final class OperatorGrantedNotification extends Notification implements ShouldQueue
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
            ->subject('Rôle opérateur attribué')
            ->line('Le rôle opérateur de la console eGuardImmo vient d\'être attribué au compte '.MailText::markdown($this->granteeEmail).'.')
            ->line('Si cette attribution n\'est pas prévue, signalez-la immédiatement.');
    }
}

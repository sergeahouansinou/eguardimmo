<?php

declare(strict_types=1);

namespace App\Modules\Banking\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Alerte au titulaire : un compte bancaire suivi a été créé, remplacé ou fermé. Ni IBAN, ni libellé, ni nom de banque.
 */
final class BankAccountChangedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly string $change)
    {
        $this->afterCommit();
    }

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $action = match ($this->change) {
            'replaced' => 'remplacé',
            'closed' => 'fermé',
            default => 'ajouté',
        };

        return (new MailMessage)
            ->subject('Un compte bancaire suivi a été '.$action)
            ->line('Un compte bancaire suivi pour le rapprochement a été '.$action.' dans votre organisation.')
            ->line("Si vous n'êtes pas à l'origine de cette modification, contactez votre équipe et changez vos accès sans attendre.");
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Parties\Notifications;

use App\Shared\Mail\MailText;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Alerte envoyée à l'adresse principale de la fiche quand l'agence modifie des coordonnées bancaires : ni IBAN, ni nom du titulaire.
 */
final class BankAccountChangedAlertNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly string $organizationName)
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
        return (new MailMessage)
            ->subject('Vos coordonnées bancaires ont été modifiées')
            ->line('L\'agence '.MailText::markdown($this->organizationName).' vient de modifier les coordonnées bancaires enregistrées sur votre fiche.')
            ->line('Si vous n\'êtes pas à l\'origine de cette modification, contactez l\'agence sans attendre.');
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Parties\Notifications;

use App\Shared\Mail\MailText;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Ni nom de mandant, ni lien : le propriétaire sait que l'accès est coupé et à qui s'adresser.
 */
final class OwnerAccessRevokedNotification extends Notification implements ShouldQueue
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
            ->subject('Votre accès à l\'espace propriétaire a été révoqué')
            ->line('L\'agence '.MailText::markdown($this->organizationName).' a mis fin au rattachement de votre compte eGuardImmo à votre dossier de propriétaire.')
            ->line('Vous ne voyez plus ce dossier dans votre espace. Si vous ne vous y attendiez pas, contactez l\'agence.');
    }
}

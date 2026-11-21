<?php

declare(strict_types=1);

namespace App\Modules\Identity\Notifications;

use App\Shared\Mail\MailText;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Le code d'appariement ne figure jamais dans ce message : l'agence le remet hors e-mail.
 */
final class OwnerInvitationNotification extends Notification implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly string $organizationName,
        #[\SensitiveParameter] public readonly string $acceptUrl,
        public readonly int $validityDays,
    ) {
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
            ->subject(MailText::plain($this->organizationName).' vous invite sur votre espace propriétaire eGuardImmo')
            ->line('L\'agence '.MailText::markdown($this->organizationName).' vous invite à rattacher votre compte eGuardImmo à votre dossier de propriétaire, pour suivre la gestion de vos biens en ligne.')
            ->line('Connectez-vous avec cette adresse e-mail, confirmée, puis saisissez le code d\'appariement que votre agence vous a remis par un autre moyen (en main propre ou par téléphone). Vous pourrez révoquer ce rattachement à tout moment.')
            ->action('Accepter l\'invitation', $this->acceptUrl)
            ->line('Ce lien est valable '.$this->validityDays.' jours. Si vous n\'attendiez pas cette invitation, ignorez ce message : sans le code, rien n\'est accessible.');
    }
}

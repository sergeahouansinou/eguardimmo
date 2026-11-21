<?php

declare(strict_types=1);

namespace App\Modules\Identity\Notifications;

use App\Shared\Mail\MailText;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

final class TenantInvitationNotification extends Notification implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly string $organizationName,
        #[\SensitiveParameter] public readonly string $acceptUrl,
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
            ->subject(MailText::plain($this->organizationName).' vous invite sur votre espace locataire eGuardImmo')
            ->line('L\'agence '.MailText::markdown($this->organizationName).' vous invite à rattacher votre compte eGuardImmo à votre dossier de location, pour consulter votre bail en ligne.')
            ->line('Connectez-vous avec cette adresse e-mail, confirmée, puis acceptez l\'invitation : vous pourrez la révoquer à tout moment.')
            ->action('Accepter l\'invitation', $this->acceptUrl)
            ->line('Ce lien est valable 7 jours. Si vous n\'attendiez pas cette invitation, ignorez ce message.');
    }
}

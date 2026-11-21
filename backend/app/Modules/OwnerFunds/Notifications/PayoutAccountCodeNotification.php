<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Code à six chiffres : ni IBAN, ni montant, ni nom d'agence. Valable quelques minutes, trois essais ; chiffrée dans la file.
 */
final class PayoutAccountCodeNotification extends Notification implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;

    public function __construct(
        #[\SensitiveParameter] public readonly string $code,
        public readonly int $minutes,
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
            ->subject('Votre code de confirmation')
            ->line('Vous avez demandé le changement de votre compte de paiement. Code de confirmation : '.$this->code)
            ->line('Il est valable '.$this->minutes.' minutes. Si vous n\'êtes pas à l\'origine de cette demande, ne le communiquez à personne et signalez-le à votre agence.');
    }
}

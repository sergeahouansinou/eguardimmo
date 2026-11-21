<?php

declare(strict_types=1);

namespace App\Modules\Parties\Notifications;

use App\Shared\Mail\MailText;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Alerte envoyée à l'adresse principale de la fiche du mandant, jamais à celle qu'une agence a saisie : si un agent détourne un
 * rattachement, le propriétaire réel le sait. Ni le code d'appariement, ni l'adresse invitée n'y figurent.
 */
final class OwnerLinkAlertNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public const string INVITED = 'invited';

    public const string LINKED = 'linked';

    public function __construct(
        public readonly string $organizationName,
        public readonly string $kind,
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
        $agence = MailText::markdown($this->organizationName);

        return $this->kind === self::LINKED
            ? (new MailMessage)
                ->subject('Un compte a été rattaché à votre dossier de propriétaire')
                ->line('Un compte eGuardImmo vient d\'être rattaché à votre dossier de propriétaire chez l\'agence '.$agence.'.')
                ->line('Si ce n\'est pas vous, contactez l\'agence sans attendre : elle peut révoquer ce rattachement immédiatement.')
            : (new MailMessage)
                ->subject('Une invitation à votre espace propriétaire a été émise')
                ->line('L\'agence '.$agence.' a invité une adresse e-mail à rattacher un compte eGuardImmo à votre dossier de propriétaire.')
                ->line('Si vous ne l\'attendiez pas, contactez l\'agence : tant que le code d\'appariement n\'a pas été saisi, rien n\'est accessible.');
    }
}

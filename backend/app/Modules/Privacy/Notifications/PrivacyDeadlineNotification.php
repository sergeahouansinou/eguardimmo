<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Alerte sans contenu : un nombre de demandes proches de leur échéance, ni nom, ni type, ni adresse.
 */
final class PrivacyDeadlineNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly int $count) {}

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
            ->subject('Demandes de données personnelles proches de leur échéance')
            ->line("{$this->count} demande(s) de données personnelles arrivent à échéance dans les sept jours ou l'ont dépassée.")
            ->line('Ouvrez la console pour les traiter.');
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Identity\Notifications;

use App\Modules\Identity\Support\Hub;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

final class NewDeviceLoginNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly string $device) {}

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
            ->subject('Nouvelle connexion à votre compte')
            ->line('Une connexion à votre compte eGuardImmo vient d\'avoir lieu depuis un nouvel appareil ('.$this->device.').')
            ->line('Si ce n\'était pas vous, changez votre mot de passe et révoquez cet appareil depuis votre profil.')
            ->action('Sécuriser mon compte', Hub::url('/mot-de-passe-oublie'));
    }
}

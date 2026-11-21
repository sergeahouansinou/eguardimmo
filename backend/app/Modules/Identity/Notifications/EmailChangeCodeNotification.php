<?php

declare(strict_types=1);

namespace App\Modules\Identity\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use SensitiveParameter;

final class EmailChangeCodeNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(#[SensitiveParameter] private readonly string $code) {}

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
            ->subject('Votre code de confirmation eGuardImmo')
            ->line('Pour confirmer cette adresse comme adresse de votre compte eGuardImmo, saisissez ce code :')
            ->line($this->code)
            ->line('Il est valable 15 minutes. Si vous n\'êtes pas à l\'origine de cette demande, ignorez ce message.');
    }
}

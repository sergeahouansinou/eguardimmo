<?php

declare(strict_types=1);

namespace App\Modules\Identity\Notifications;

use App\Modules\Identity\Support\Hub;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\URL;

final class VerifyEmailNotification extends Notification implements ShouldQueue
{
    use Queueable;

    private const VALIDITE_MINUTES = 60;

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
            ->subject('Confirmez votre adresse e-mail')
            ->line('Bienvenue sur eGuardImmo. Confirmez votre adresse e-mail pour accéder à vos espaces.')
            ->action('Confirmer mon adresse', $this->url($notifiable))
            ->line('Ce lien expire dans '.self::VALIDITE_MINUTES.' minutes.')
            ->line('Si vous n\'avez pas créé de compte, ignorez ce message.');
    }

    public function url(object $notifiable): string
    {
        $id = $notifiable instanceof MustVerifyEmail && method_exists($notifiable, 'getKey') ? $notifiable->getKey() : null;
        $email = $notifiable instanceof MustVerifyEmail ? $notifiable->getEmailForVerification() : '';

        $lienApi = URL::temporarySignedRoute('verification.verify', now()->addMinutes(self::VALIDITE_MINUTES), [
            'id' => $id,
            'hash' => hash('sha1', $email),
        ]);

        return Hub::url('/verification-email').'?'.http_build_query(['url' => $lienApi]);
    }
}

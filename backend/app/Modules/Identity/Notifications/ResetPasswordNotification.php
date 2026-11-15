<?php

declare(strict_types=1);

namespace App\Modules\Identity\Notifications;

use App\Modules\Identity\Support\Hub;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Auth\CanResetPassword;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use SensitiveParameter;

final class ResetPasswordNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(#[SensitiveParameter] public readonly string $token) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $email = $notifiable instanceof CanResetPassword ? $notifiable->getEmailForPasswordReset() : '';

        $url = Hub::url('/mot-de-passe/nouveau').'?'.http_build_query(['jeton' => $this->token, 'email' => $email]);

        return (new MailMessage)
            ->subject('Définir ou réinitialiser votre mot de passe')
            ->line('Vous avez demandé à définir ou réinitialiser le mot de passe de votre compte eGuardImmo.')
            ->action('Choisir un mot de passe', $url)
            ->line('Ce lien expire dans '.config('auth.passwords.users.expire').' minutes.')
            ->line('Si vous n\'êtes pas à l\'origine de cette demande, ignorez ce message.');
    }
}

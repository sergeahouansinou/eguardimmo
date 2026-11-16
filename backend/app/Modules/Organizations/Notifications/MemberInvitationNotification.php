<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

final class MemberInvitationNotification extends Notification implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly string $organizationName,
        public readonly string $inviterName,
        #[\SensitiveParameter] public readonly string $acceptUrl,
        public readonly ?string $personalMessage,
    ) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $message = (new MailMessage)
            ->subject('Invitation à rejoindre '.$this->organizationName.' sur eGuardImmo')
            ->line($this->inviterName.' vous invite à rejoindre l\'équipe '.$this->organizationName.' sur eGuardImmo.');

        if ($this->personalMessage !== null) {
            $message->line('Son message : « '.$this->personalMessage.' »');
        }

        return $message
            ->action('Accepter l\'invitation', $this->acceptUrl)
            ->line('Ce lien est valable 7 jours. Si vous n\'attendiez pas cette invitation, ignorez ce message.');
    }
}

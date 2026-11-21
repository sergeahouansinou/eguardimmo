<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

final class NotificationMail extends Mailable
{
    public function __construct(
        public readonly string $titre,
        public readonly string $corps,
        public readonly ?string $lien,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->titre);
    }

    public function content(): Content
    {
        return new Content(text: 'notifications::mail.notification');
    }
}

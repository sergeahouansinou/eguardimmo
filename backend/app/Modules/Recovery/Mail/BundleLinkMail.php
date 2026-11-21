<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * Le message ne porte qu'un lien https : jamais le ZIP (ADR 0023).
 */
final class BundleLinkMail extends Mailable
{
    public function __construct(
        public readonly string $organisation,
        public readonly string $dossier,
        public readonly string $expire,
        #[\SensitiveParameter] public readonly string $lien,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "Pièces du dossier de recouvrement {$this->dossier}");
    }

    public function content(): Content
    {
        return new Content(text: 'recovery::mail.bundle-link');
    }
}

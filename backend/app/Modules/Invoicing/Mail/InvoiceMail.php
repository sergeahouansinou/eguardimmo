<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Mail;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * Texte brut : la vue n'échappe pas le HTML (`{!! !!}` est voulu), mais le nom de l'organisation perd ses caractères de
 * contrôle pour ne pas injecter de lignes dans le corps ni dans l'objet. Partie en file : le PDF n'est pas copié dans la charge utile, il est relu dans Documents au moment de l'envoi.
 */
final class InvoiceMail extends Mailable implements ShouldQueue
{
    public int $tries = 3;

    public readonly string $organisation;

    public function __construct(
        string $organisation,
        public readonly string $numero,
        public readonly bool $avoir,
        public readonly ?string $echeance,
        private readonly string $organizationId,
        private readonly string $fileId,
    ) {
        $this->organisation = trim((string) preg_replace('/[\p{Cc}\p{Cf}]+/u', ' ', $organisation));
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: ($this->avoir ? 'Avoir ' : 'Facture ')."{$this->numero} de {$this->organisation}");
    }

    public function content(): Content
    {
        return new Content(text: 'invoicing::mail.invoice');
    }

    /**
     * @return list<Attachment>
     */
    public function attachments(): array
    {
        return [
            Attachment::fromData(
                fn (): string => app(CurrentOrganization::class)->run($this->organizationId, fn (): string => app(DocumentStore::class)->contents($this->fileId)),
                ($this->avoir ? 'avoir-' : 'facture-').$this->numero.'.pdf',
            )->withMime('application/pdf'),
        ];
    }
}

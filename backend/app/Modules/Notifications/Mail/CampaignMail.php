<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailables\Headers;

/**
 * E-mail de diffusion : expéditeur sur le domaine de la plateforme, en-têtes `List-Unsubscribe` (RFC 8058), aucun pixel, aucun lien de suivi.
 */
final class CampaignMail extends Mailable
{
    /**
     * @param  list<array{name: string, contents: string}>  $pieces  pièces jointes, pour une fiche sans compte seulement
     */
    public function __construct(
        public readonly string $expediteur,
        public readonly string $nomOrganisation,
        public readonly string $objet,
        public readonly string $corps,
        public readonly ?string $desinscription,
        public readonly ?string $envoiId,
        public readonly ?string $lienEspace,
        public readonly int $piecesEnLien,
        public readonly array $pieces,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(from: new Address($this->expediteur, $this->nomOrganisation), subject: $this->objet);
    }

    public function content(): Content
    {
        return new Content(text: 'notifications::mail.campaign');
    }

    public function headers(): Headers
    {
        if ($this->desinscription === null || $this->envoiId === null) {
            return new Headers;
        }

        return new Headers(text: [
            'List-Unsubscribe' => '<'.$this->desinscription.'>',
            'List-Unsubscribe-Post' => 'List-Unsubscribe=One-Click',
            'Precedence' => 'bulk',
            'X-MT-Custom-Variables' => (string) json_encode(['delivery_id' => $this->envoiId]),
        ]);
    }

    /**
     * @return list<Attachment>
     */
    public function attachments(): array
    {
        return array_map(
            fn (array $piece): Attachment => Attachment::fromData(fn (): string => $piece['contents'], $piece['name'])->withMime('application/pdf'),
            $this->pieces,
        );
    }
}

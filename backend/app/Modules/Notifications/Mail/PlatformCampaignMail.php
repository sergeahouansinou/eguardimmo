<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailables\Headers;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\Part\DataPart;

/**
 * Campagne HTML de la plateforme : images embarquées (`cid:`), en-têtes `List-Unsubscribe` (RFC 8058), aucun pixel ni lien suivi.
 */
final class PlatformCampaignMail extends Mailable
{
    public const string SENDER = 'eGuardImmo';

    private const string CID_DOMAIN = '@eguardimmo';

    /**
     * @param  string  $contenu  HTML déjà assaini
     * @param  list<array{id: string, name: string, mime: string, contents: string, inline: bool}>  $images
     */
    public function __construct(
        public readonly string $expediteur,
        public readonly string $objet,
        public readonly string $contenu,
        public readonly string $texte,
        public readonly ?string $desinscription,
        public readonly ?string $envoiId,
        public readonly array $images,
    ) {
        $this->withSymfonyMessage(function (Email $message): void {
            foreach ($this->images as $image) {
                $piece = new DataPart($image['contents'], $image['name'], $image['mime']);

                if ($image['inline']) {
                    $piece->setContentId($image['id'].self::CID_DOMAIN)->asInline();
                }

                $message->addPart($piece);
            }
        });
    }

    public function envelope(): Envelope
    {
        return new Envelope(from: new Address($this->expediteur, self::SENDER), subject: $this->objet);
    }

    public function content(): Content
    {
        $html = $this->contenu;

        foreach ($this->images as $image) {
            $html = str_replace('src="cid:'.$image['id'].'"', 'src="cid:'.$image['id'].self::CID_DOMAIN.'"', $html);
        }

        return new Content(view: 'notifications::mail.platform', text: 'notifications::mail.platform-text', with: ['corpsHtml' => $html]);
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
}

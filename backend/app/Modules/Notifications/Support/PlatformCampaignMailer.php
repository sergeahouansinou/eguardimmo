<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

use App\Modules\Notifications\Mail\PlatformCampaignMail;
use App\Modules\Notifications\Models\PlatformCampaign;
use App\Modules\Notifications\Models\PlatformCampaignDelivery;
use Illuminate\Support\Facades\Mail;

final readonly class PlatformCampaignMailer
{
    public function __construct(
        private MailProvider $fournisseur,
        private CampaignHtml $html,
        private CampaignImageFiles $fichiers,
        private UnsubscribeToken $jetons,
    ) {}

    /**
     * @param  PlatformCampaignDelivery|null  $envoi  null pour un essai : ni lien de désinscription ni identifiant de suivi du fournisseur
     * @param  array<string, string>  $cache  contenu des images déjà lues, par identifiant
     * @return string|null identifiant du message chez le fournisseur
     */
    public function send(PlatformCampaign $campagne, string $adresse, ?PlatformCampaignDelivery $envoi, array &$cache = []): ?string
    {
        $corps = (string) $campagne->html;
        $citees = $this->html->citedImages($corps);
        $images = [];

        foreach ($campagne->images as $image) {
            $cache[$image->id] ??= $this->fichiers->contents($image);
            $images[] = ['id' => $image->id, 'name' => $image->name, 'mime' => $image->mime, 'contents' => $cache[$image->id], 'inline' => in_array($image->id, $citees, true)];
        }

        $courrier = new PlatformCampaignMail(
            $this->fournisseur->fromAddress(),
            $envoi === null ? '[Test] '.$campagne->subject : (string) $campagne->subject,
            $corps,
            $this->html->toText($corps),
            $envoi === null ? null : $this->jetons->url($envoi),
            $envoi?->id,
            $images,
        );

        return Mail::mailer($this->fournisseur->mailer())->to($adresse)->send($courrier)?->getMessageId();
    }
}

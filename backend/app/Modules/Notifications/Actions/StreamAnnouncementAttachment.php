<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Notifications\Enums\CampaignAudience;
use App\Modules\Notifications\Enums\ErrorCode;
use App\Modules\Notifications\Queries\Announcements;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

final readonly class StreamAnnouncementAttachment
{
    public function __construct(
        private Announcements $annonces,
        private CurrentOrganization $organisation,
        private StreamCampaignAttachment $flux,
    ) {}

    /**
     * La pièce ne se sert qu'à un compte qui voit l'annonce : même 404 pour une annonce inconnue, d'un autre compte ou quittée.
     */
    public function handle(string $userId, CampaignAudience $audience, string $campagneId, string $pieceId): StreamedResponse
    {
        $ligne = Str::isUuid($campagneId) ? $this->annonces->rows($userId, $audience)->where('dedup_key', 'campaign:'.strtolower($campagneId))->first() : null;

        if ($ligne === null || $ligne->organization_id === null) {
            throw ErrorCode::AnnouncementNotFound->problem();
        }

        /** @var StreamedResponse $reponse */
        $reponse = $this->organisation->run($ligne->organization_id, fn (): StreamedResponse => $this->flux->handle(strtolower($campagneId), $pieceId));

        return $reponse;
    }
}

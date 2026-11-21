<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Notifications\Enums\CampaignAudience;
use App\Modules\Notifications\Enums\ErrorCode;
use App\Modules\Notifications\Models\CampaignDelivery;
use App\Modules\Notifications\Queries\Announcements;
use App\Modules\Notifications\Support\AnnouncementView;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Str;

final readonly class ReadAnnouncement
{
    public function __construct(
        private Announcements $annonces,
        private CurrentOrganization $organisation,
    ) {}

    /**
     * « Lu » ne signifie que la lecture dans l'espace : aucun pixel de suivi. Rejouable ; une annonce qu'on ne peut plus voir répond 404.
     */
    public function handle(string $userId, CampaignAudience $audience, string $campagneId): AnnouncementView
    {
        $ligne = Str::isUuid($campagneId) ? $this->annonces->rows($userId, $audience)->where('dedup_key', 'campaign:'.strtolower($campagneId))->first() : null;

        $organisationId = $ligne?->organization_id;
        $partieId = $ligne?->party_id;

        if ($ligne === null || $organisationId === null || $partieId === null) {
            throw ErrorCode::AnnouncementNotFound->problem();
        }

        if ($ligne->read_at === null) {
            $ligne->forceFill(['read_at' => now()])->save();
        }

        $this->organisation->run($organisationId, function () use ($partieId, $campagneId): void {
            $maintenant = now()->format('Y-m-d H:i:s.u');
            CampaignDelivery::query()->where('campaign_id', strtolower($campagneId))->where('party_id', $partieId)->whereNull('read_at')
                ->update(['read_at' => $maintenant, 'updated_at' => $maintenant]);
        });

        return $this->annonces->find($userId, $audience, $campagneId);
    }
}

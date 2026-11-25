<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Notifications\Data\PlatformCampaignDraft;
use App\Modules\Notifications\Data\PlatformCampaignSaved;
use App\Modules\Notifications\Enums\ErrorCode;
use App\Modules\Notifications\Enums\PlatformCampaignStatus;
use App\Modules\Notifications\Queries\PlatformCampaigns;
use App\Modules\Notifications\Support\CampaignImageFiles;
use App\Modules\Notifications\Support\PlatformCampaignComposer;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

final readonly class UpdatePlatformCampaign
{
    public function __construct(
        private PlatformCampaigns $campagnes,
        private PlatformCampaignComposer $redaction,
        private CampaignImageFiles $fichiers,
        private RecordAudit $audit,
    ) {}

    public function handle(string $campagneId, PlatformCampaignDraft $brouillon, string $operateurId): PlatformCampaignSaved
    {
        $ecrits = [];

        try {
            return DB::transaction(function () use ($campagneId, $brouillon, $operateurId, &$ecrits): PlatformCampaignSaved {
                $campagne = $this->campagnes->locked($campagneId);

                if ($campagne->status !== PlatformCampaignStatus::Draft) {
                    throw ErrorCode::PlatformCampaignNotEditable->problem();
                }

                if ($campagne->lock_version !== $brouillon->lockVersion) {
                    throw ErrorCode::PlatformCampaignStale->problem();
                }

                if ($campagne->channel !== $brouillon->channel) {
                    throw ValidationException::withMessages(['channel' => 'Le canal d\'une campagne ne se change pas.']);
                }

                $campagne->forceFill(['lock_version' => $campagne->lock_version + 1]);
                $resultat = $this->redaction->apply($campagne, $brouillon, $ecrits);
                $this->audit->handle('console.marketing.campaign_updated', $operateurId, [
                    'category' => $campagne->category->value,
                    'audience' => $campagne->audience->value,
                    'selected_count' => count($campagne->recipient_user_ids),
                ], $campagne);
                DB::afterCommit(fn () => $this->fichiers->delete($resultat['removed']));

                return new PlatformCampaignSaved($campagne->id, $resultat['unknown']);
            });
        } catch (Throwable $erreur) {
            $this->fichiers->delete($ecrits);

            throw $erreur;
        }
    }
}

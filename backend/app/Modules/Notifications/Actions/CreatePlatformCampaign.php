<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Notifications\Data\PlatformCampaignDraft;
use App\Modules\Notifications\Data\PlatformCampaignSaved;
use App\Modules\Notifications\Enums\PlatformCampaignStatus;
use App\Modules\Notifications\Models\PlatformCampaign;
use App\Modules\Notifications\Support\CampaignImageFiles;
use App\Modules\Notifications\Support\PlatformCampaignComposer;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;
use Throwable;

final readonly class CreatePlatformCampaign
{
    public function __construct(
        private PlatformCampaignComposer $redaction,
        private CampaignImageFiles $fichiers,
        private RecordAudit $audit,
    ) {}

    public function handle(PlatformCampaignDraft $brouillon, string $operateurId): PlatformCampaignSaved
    {
        $ecrits = [];

        try {
            return DB::transaction(function () use ($brouillon, $operateurId, &$ecrits): PlatformCampaignSaved {
                $campagne = (new PlatformCampaign)->forceFill(['status' => PlatformCampaignStatus::Draft, 'created_by_user_id' => $operateurId, 'lock_version' => 1, 'recipient_count' => 0]);
                $resultat = $this->redaction->apply($campagne, $brouillon, $ecrits);
                $this->audit->handle('console.marketing.campaign_created', $operateurId, [
                    'channel' => $campagne->channel->value,
                    'category' => $campagne->category->value,
                    'audience' => $campagne->audience->value,
                    'selected_count' => count($campagne->recipient_user_ids),
                ], $campagne);

                return new PlatformCampaignSaved($campagne->id, $resultat['unknown']);
            });
        } catch (Throwable $erreur) {
            $this->fichiers->delete($ecrits);

            throw $erreur;
        }
    }
}

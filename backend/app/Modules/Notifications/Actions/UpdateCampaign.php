<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Data\CampaignInput;
use App\Modules\Notifications\Enums\CampaignStatus;
use App\Modules\Notifications\Enums\ErrorCode;
use App\Modules\Notifications\Models\Campaign;
use App\Modules\Notifications\Support\CampaignComposition;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class UpdateCampaign
{
    public function __construct(
        private CampaignComposition $composition,
        private RecordAudit $audit,
    ) {}

    /**
     * Seul un brouillon se modifie ; `$version` est celle que le client a lue : une modification concurrente répond 409.
     */
    public function handle(User $auteur, string $campagneId, CampaignInput $entree, int $version): Campaign
    {
        $this->composition->assertAllowed($auteur, $entree);

        return DB::transaction(function () use ($campagneId, $entree, $version): Campaign {
            $campagne = Campaign::query()->whereKey($campagneId)->lockForUpdate()->first() ?? throw ErrorCode::CampaignNotFound->problem();

            if ($campagne->status !== CampaignStatus::Draft) {
                throw ErrorCode::CampaignNotEditable->problem();
            }

            if ($campagne->lock_version !== $version) {
                throw ErrorCode::CampaignVersionConflict->problem();
            }

            $campagne->fill([
                'subject' => $entree->subject,
                'body' => $entree->body,
                'audience' => $entree->audience,
                'building_ids' => $entree->buildingIds,
                'copy_to_history' => $entree->copyToHistory,
            ]);
            $campagne->forceFill(['lock_version' => $campagne->lock_version + 1])->save();
            $this->audit->handle('notifications.campaign.updated', metadata: ['audience' => $entree->audience->value, 'building_count' => count($entree->buildingIds)], subject: $campagne);

            return $campagne;
        });
    }
}

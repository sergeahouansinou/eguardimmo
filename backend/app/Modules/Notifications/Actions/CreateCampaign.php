<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Data\CampaignInput;
use App\Modules\Notifications\Enums\CampaignStatus;
use App\Modules\Notifications\Models\Campaign;
use App\Modules\Notifications\Support\CampaignComposition;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class CreateCampaign
{
    public function __construct(
        private CampaignComposition $composition,
        private RecordAudit $audit,
    ) {}

    public function handle(User $auteur, CampaignInput $entree): Campaign
    {
        $this->composition->assertAllowed($auteur, $entree);

        return DB::transaction(function () use ($auteur, $entree): Campaign {
            $campagne = new Campaign;
            $campagne->fill([
                'subject' => $entree->subject,
                'body' => $entree->body,
                'audience' => $entree->audience,
                'building_ids' => $entree->buildingIds,
                'copy_to_history' => $entree->copyToHistory,
                'created_by_user_id' => $auteur->id,
            ]);
            $campagne->forceFill(['status' => CampaignStatus::Draft])->save();
            $this->audit->handle('notifications.campaign.created', metadata: ['audience' => $entree->audience->value, 'building_count' => count($entree->buildingIds)], subject: $campagne);

            return $campagne;
        });
    }
}

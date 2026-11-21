<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Enums\CampaignStatus;
use App\Modules\Notifications\Enums\ErrorCode;
use App\Modules\Notifications\Models\Campaign;
use App\Modules\Notifications\Support\CampaignAccess;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class CancelCampaign
{
    public function __construct(
        private CampaignAccess $acces,
        private RecordAudit $audit,
    ) {}

    /**
     * Seule une diffusion programmée s'annule ; l'annuler deux fois répond comme la première.
     */
    public function handle(User $auteur, string $campagneId): Campaign
    {
        $this->acces->assertManager($auteur);

        return DB::transaction(function () use ($campagneId): Campaign {
            $campagne = Campaign::query()->whereKey($campagneId)->lockForUpdate()->first() ?? throw ErrorCode::CampaignNotFound->problem();

            if ($campagne->status === CampaignStatus::Cancelled) {
                return $campagne;
            }

            if ($campagne->status !== CampaignStatus::Scheduled) {
                throw ErrorCode::CampaignNotEditable->problem();
            }

            $campagne->forceFill([
                'status' => CampaignStatus::Cancelled,
                'cancelled_at' => now(),
                'lock_version' => $campagne->lock_version + 1,
            ])->save();
            $this->audit->handle('notifications.campaign.cancelled', subject: $campagne);

            return $campagne;
        });
    }
}

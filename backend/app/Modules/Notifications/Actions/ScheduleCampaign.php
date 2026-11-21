<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Enums\CampaignStatus;
use App\Modules\Notifications\Enums\ErrorCode;
use App\Modules\Notifications\Models\Campaign;
use App\Modules\Notifications\Queries\CampaignAudiences;
use App\Modules\Notifications\Support\CampaignAccess;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class ScheduleCampaign
{
    public const int DELAI_MINIMUM_MINUTES = 15;

    public function __construct(
        private CampaignAccess $acces,
        private CampaignAudiences $audiences,
        private RecordAudit $audit,
    ) {}

    public function handle(User $auteur, string $campagneId, CarbonImmutable $quand): Campaign
    {
        $this->acces->assertManager($auteur);

        if ($quand->lessThan(now()->addMinutes(self::DELAI_MINIMUM_MINUTES))) {
            throw ErrorCode::CampaignScheduleInvalid->problem();
        }

        return DB::transaction(function () use ($auteur, $campagneId, $quand): Campaign {
            $campagne = Campaign::query()->whereKey($campagneId)->lockForUpdate()->first() ?? throw ErrorCode::CampaignNotFound->problem();

            if ($campagne->status !== CampaignStatus::Draft) {
                throw ErrorCode::CampaignNotEditable->problem();
            }

            if ($this->audiences->members($campagne->audience, $campagne->building_ids, CarbonImmutable::today()) === []) {
                throw ErrorCode::CampaignAudienceEmpty->problem();
            }

            $campagne->forceFill([
                'status' => CampaignStatus::Scheduled,
                'scheduled_at' => $quand,
                'sent_by_user_id' => $auteur->id,
                'lock_version' => $campagne->lock_version + 1,
            ])->save();
            $this->audit->handle('notifications.campaign.scheduled', metadata: ['scheduled_at' => $quand->toIso8601String()], subject: $campagne);

            return $campagne;
        });
    }
}

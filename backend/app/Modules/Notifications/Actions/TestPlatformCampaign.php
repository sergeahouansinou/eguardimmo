<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Enums\ErrorCode;
use App\Modules\Notifications\Enums\MarketingChannel;
use App\Modules\Notifications\Models\PlatformCampaign;
use App\Modules\Notifications\Push\PushChannel;
use App\Modules\Notifications\Queries\ActivePushTokens;
use App\Modules\Notifications\Queries\PlatformCampaigns;
use App\Modules\Notifications\Support\MailProvider;
use App\Modules\Notifications\Support\PlatformCampaignMailer;
use App\Modules\Notifications\Support\PlatformCampaignPush;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final readonly class TestPlatformCampaign
{
    public function __construct(
        private PlatformCampaigns $campagnes,
        private MailProvider $fournisseur,
        private PlatformCampaignMailer $courriers,
        private PushChannel $canal,
        private ActivePushTokens $appareils,
        private PlatformCampaignPush $push,
        private RecordAudit $audit,
    ) {}

    /**
     * Essai envoyé au seul opérateur connecté, sans ligne d'envoi.
     *
     * @return string adresse de l'opérateur
     */
    public function handle(string $campagneId, string $operateurId): string
    {
        $campagne = $this->campagnes->find($campagneId);
        $operateur = User::query()->findOrFail($operateurId);

        if ($campagne->channel === MarketingChannel::Email) {
            $this->fournisseur->assertEnabled();
            $this->courriers->send($campagne, $operateur->email, null);
        } else {
            $this->sendPush($campagne, $operateurId);
        }

        DB::transaction(fn () => $this->audit->handle('console.marketing.campaign_tested', $operateurId, ['channel' => $campagne->channel->value], $campagne));

        return $operateur->email;
    }

    private function sendPush(PlatformCampaign $campagne, string $operateurId): void
    {
        if (! $this->canal->enabled()) {
            throw ErrorCode::PushSendingDisabled->problem();
        }

        if ($this->appareils->for($operateurId) === []
            || ! $this->push->send($campagne, $operateurId, 'platform-campaign-test:'.$campagne->id.':'.Str::uuid7(), '[Test] ')) {
            throw ErrorCode::PlatformCampaignNoDevice->problem();
        }
    }
}

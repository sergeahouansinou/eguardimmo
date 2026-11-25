<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Notifications\Enums\ErrorCode;
use App\Modules\Notifications\Enums\MarketingChannel;
use App\Modules\Notifications\Enums\PlatformCampaignStatus;
use App\Modules\Notifications\Enums\PlatformDeliveryStatus;
use App\Modules\Notifications\Models\PlatformCampaign;
use App\Modules\Notifications\Models\PlatformCampaignDelivery;
use App\Modules\Notifications\Push\PushChannel;
use App\Modules\Notifications\Queries\PlatformCampaigns;
use App\Modules\Notifications\Support\MailProvider;
use App\Modules\Notifications\Support\PlatformCampaignBatches;
use App\Modules\Notifications\Support\PlatformRecipients;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final readonly class SendPlatformCampaign
{
    public function __construct(
        private PlatformCampaigns $campagnes,
        private PlatformRecipients $destinataires,
        private MailProvider $fournisseur,
        private PushChannel $push,
        private PlatformCampaignBatches $paquets,
        private RecordAudit $audit,
    ) {}

    /**
     * Tout ou rien, campagne verrouillée : les destinataires sont recalculés ici, un rejeu trouve la campagne partie et ne crée rien.
     */
    public function handle(string $campagneId, int $version, string $operateurId): void
    {
        DB::transaction(function () use ($campagneId, $version, $operateurId): void {
            $campagne = $this->campagnes->locked($campagneId);

            if ($campagne->status !== PlatformCampaignStatus::Draft) {
                throw ErrorCode::PlatformCampaignNotEditable->problem();
            }

            if ($campagne->lock_version !== $version) {
                throw ErrorCode::PlatformCampaignStale->problem();
            }

            $this->assertChannelEnabled($campagne->channel);
            $lignes = $this->prepare($campagne);
            $maintenant = now()->toImmutable();
            $campagne->forceFill([
                'status' => PlatformCampaignStatus::Sending,
                'recipient_count' => $lignes['total'],
                'sent_by_user_id' => $operateurId,
                'sending_started_at' => $maintenant,
                'lock_version' => $campagne->lock_version + 1,
            ])->save();
            $this->audit->handle('console.marketing.campaign_sent', $operateurId, [
                'channel' => $campagne->channel->value,
                'category' => $campagne->category->value,
                'audience' => $campagne->audience->value,
                'recipient_count' => $lignes['total'],
                'eligible_count' => $lignes['eligible'],
            ], $campagne);
            $this->paquets->dispatch($campagne->id);
        });
    }

    private function assertChannelEnabled(MarketingChannel $canal): void
    {
        if ($canal === MarketingChannel::Email) {
            $this->fournisseur->assertEnabled();
        } elseif (! $this->push->enabled()) {
            throw ErrorCode::PushSendingDisabled->problem();
        }
    }

    /**
     * @return array{total: int, eligible: int}
     */
    private function prepare(PlatformCampaign $campagne): array
    {
        $plafond = (int) config('notifications.marketing.max_recipients');
        $total = 0;
        $joignables = 0;
        $sansAppareil = 0;

        foreach ($this->destinataires->chunks($campagne) as $comptes) {
            $lignes = [];
            $maintenant = now()->format('Y-m-d H:i:s.u');

            foreach ($this->destinataires->classify($campagne, $comptes) as $compte => $verdict) {
                $joignables += $verdict['status'] === PlatformDeliveryStatus::Queued ? 1 : 0;
                $sansAppareil += $verdict['status'] === PlatformDeliveryStatus::SkippedNoDevice ? 1 : 0;
                $lignes[] = [
                    'id' => (string) Str::uuid7(),
                    'campaign_id' => $campagne->id,
                    'user_id' => $compte,
                    'email_hash' => $verdict['hash'],
                    'status' => $verdict['status']->value,
                    'error_code' => $verdict['error'],
                    'created_at' => $maintenant,
                    'updated_at' => $maintenant,
                ];
            }

            if ($joignables > $plafond) {
                throw ErrorCode::PlatformCampaignTooLarge->problem();
            }

            PlatformCampaignDelivery::query()->insert($lignes);
            $total += count($lignes);
        }

        if ($joignables === 0) {
            throw ($sansAppareil > 0 ? ErrorCode::PlatformCampaignNoDevice : ErrorCode::PlatformCampaignNoRecipient)->problem();
        }

        return ['total' => $total, 'eligible' => $joignables];
    }
}

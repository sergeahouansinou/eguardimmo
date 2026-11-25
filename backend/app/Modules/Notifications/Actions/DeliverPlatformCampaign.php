<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Notifications\Enums\MarketingChannel;
use App\Modules\Notifications\Enums\PlatformCampaignStatus;
use App\Modules\Notifications\Enums\PlatformDeliveryStatus;
use App\Modules\Notifications\Models\PlatformCampaign;
use App\Modules\Notifications\Models\PlatformCampaignDelivery;
use App\Modules\Notifications\Support\PlatformCampaignMailer;
use App\Modules\Notifications\Support\PlatformCampaignPush;
use App\Modules\Notifications\Support\PlatformRecipients;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Envoie un paquet de lignes. Chaque ligne est réservée (`queued` → `sending`) avant l'appel au fournisseur : un rejeu ne réenvoie jamais.
 */
final readonly class DeliverPlatformCampaign
{
    public function __construct(
        private PlatformRecipients $destinataires,
        private PlatformCampaignMailer $courriers,
        private PlatformCampaignPush $push,
        private FinalizePlatformCampaign $cloture,
    ) {}

    /**
     * @param  list<string>  $ids
     */
    public function handle(string $campagneId, array $ids): void
    {
        $campagne = PlatformCampaign::query()->with('images')->find($campagneId);

        if ($campagne === null || $campagne->status !== PlatformCampaignStatus::Sending) {
            return;
        }

        $images = [];
        $lignes = PlatformCampaignDelivery::query()->where('campaign_id', $campagne->id)->whereIn('id', $ids)
            ->where('status', PlatformDeliveryStatus::Queued->value)->orderBy('id')->get();

        foreach ($lignes as $ligne) {
            if ($this->reserve($ligne)) {
                $this->deliver($campagne, $ligne, $images);
            }
        }

        $this->cloture->handle($campagne->id);
    }

    private function reserve(PlatformCampaignDelivery $ligne): bool
    {
        $maintenant = now()->format('Y-m-d H:i:s.u');

        return PlatformCampaignDelivery::query()->whereKey($ligne->id)->where('status', PlatformDeliveryStatus::Queued->value)
            ->update(['status' => PlatformDeliveryStatus::Sending->value, 'attempted_at' => $maintenant, 'updated_at' => $maintenant]) === 1;
    }

    /**
     * @param  array<string, string>  $images
     */
    private function deliver(PlatformCampaign $campagne, PlatformCampaignDelivery $ligne, array &$images): void
    {
        $compte = $this->destinataires->reachable([$ligne->user_id])->first();

        if ($compte === null) {
            $this->finish($ligne, PlatformDeliveryStatus::Suppressed, ['error_code' => 'account_unavailable']);

            return;
        }

        $verdict = $this->destinataires->classify($campagne, collect([$compte]))[$compte->id];

        if ($verdict['status'] !== PlatformDeliveryStatus::Queued) {
            $this->finish($ligne, $verdict['status'], ['error_code' => $verdict['error']]);

            return;
        }

        $valeurs = [];

        try {
            if ($campagne->channel === MarketingChannel::Email) {
                $valeurs = ['email_hash' => $verdict['hash']];
                $valeurs['provider_message_id'] = $this->courriers->send($campagne, $compte->email, $ligne, $images);
            } elseif (! $this->push->send($campagne, $compte->id, 'platform-campaign:'.$campagne->id)) {
                $this->finish($ligne, PlatformDeliveryStatus::Failed, ['error_code' => 'transport']);

                return;
            }
        } catch (Throwable $erreur) {
            Log::warning('Envoi d\'une campagne en échec', ['campaign' => $campagne->id, 'delivery' => $ligne->id, 'error' => $erreur::class]);
            $this->finish($ligne, PlatformDeliveryStatus::Failed, [...$valeurs, 'error_code' => 'transport']);

            return;
        }

        $this->finish($ligne, PlatformDeliveryStatus::Sent, [...$valeurs, 'sent_at' => now()->format('Y-m-d H:i:s.u')]);
    }

    /**
     * @param  array<string, string|null>  $valeurs
     */
    private function finish(PlatformCampaignDelivery $ligne, PlatformDeliveryStatus $statut, array $valeurs): void
    {
        PlatformCampaignDelivery::query()->whereKey($ligne->id)
            ->update([...$valeurs, 'status' => $statut->value, 'updated_at' => now()->format('Y-m-d H:i:s.u')]);
    }
}

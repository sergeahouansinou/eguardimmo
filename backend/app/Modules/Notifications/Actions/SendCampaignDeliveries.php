<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\CampaignAudience;
use App\Modules\Notifications\Enums\CampaignStatus;
use App\Modules\Notifications\Enums\DeliveryStatus;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Mail\CampaignMail;
use App\Modules\Notifications\Models\Campaign;
use App\Modules\Notifications\Models\CampaignDelivery;
use App\Modules\Notifications\Queries\Suppressions;
use App\Modules\Notifications\Support\CampaignMessage;
use App\Modules\Notifications\Support\MailProvider;
use App\Modules\Notifications\Support\UnsubscribeToken;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Shared\Mail\MailText;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Envoie un paquet de lignes sous le contexte de l'organisation. Chaque ligne est réservée par une mise à jour conditionnelle `queued` →
 * `sending` avant l'appel au fournisseur : un rejeu de job ne réenvoie jamais, une issue inconnue n'est pas retentée.
 */
final readonly class SendCampaignDeliveries
{
    public function __construct(
        private MailProvider $fournisseur,
        private Suppressions $suppressions,
        private UnsubscribeToken $jetons,
        private CampaignMessage $messages,
        private OrganizationDirectory $organisations,
        private DocumentStore $documents,
        private CreateNotifications $notifications,
        private FinalizeCampaign $cloture,
    ) {}

    /**
     * @param  list<string>  $ids
     */
    public function handle(string $campagneId, array $ids): void
    {
        $campagne = Campaign::query()->with('attachments')->find($campagneId);

        if ($campagne === null || $campagne->status !== CampaignStatus::Sending) {
            return;
        }

        $nom = MailText::plain($this->organisations->names([$campagne->organization_id])[$campagne->organization_id] ?? 'Votre agence');
        $pieces = [];

        foreach (CampaignDelivery::query()->where('campaign_id', $campagne->id)->whereIn('id', $ids)->orderBy('id')->get() as $envoi) {
            if ($envoi->user_id !== null && $this->annonce($campagne)) {
                $this->annoncer($campagne, $envoi);
            }

            if ($envoi->status === DeliveryStatus::Queued && $this->reserver($envoi)) {
                $this->envoyer($campagne, $envoi, $nom, $pieces);
            }
        }

        $this->cloture->handle($campagne->id);
    }

    public function annonce(Campaign $campagne): bool
    {
        return $campagne->copy_to_history || $campagne->attachments->isNotEmpty();
    }

    private function annoncer(Campaign $campagne, CampaignDelivery $envoi): void
    {
        $this->notifications->handle(new NotificationInput(
            $campagne->audience === CampaignAudience::Tenants ? NotificationType::TenantAnnouncement : NotificationType::OwnerAnnouncement,
            $campagne->organization_id,
            'campaign:'.$campagne->id,
            leaseId: $envoi->lease_id,
            subjectId: $campagne->id,
            partyId: $envoi->party_id,
        ));
    }

    private function reserver(CampaignDelivery $envoi): bool
    {
        $maintenant = now()->format('Y-m-d H:i:s.u');

        return CampaignDelivery::query()->whereKey($envoi->id)->where('status', DeliveryStatus::Queued->value)
            ->update(['status' => DeliveryStatus::Sending->value, 'attempted_at' => $maintenant, 'updated_at' => $maintenant]) === 1;
    }

    /**
     * @param  array<string, string>  $pieces  contenu des PDF déjà lus, par fichier
     */
    private function envoyer(Campaign $campagne, CampaignDelivery $envoi, string $nomOrganisation, array &$pieces): void
    {
        $envoi->refresh();

        if ($envoi->email === null || $envoi->email_hash === null) {
            $this->terminer($envoi, DeliveryStatus::SkippedNoEmail);

            return;
        }

        if (isset($this->suppressions->among([$envoi->email_hash])[$envoi->email_hash])) {
            $this->terminer($envoi, DeliveryStatus::Suppressed);

            return;
        }

        try {
            $courrier = new CampaignMail(
                $this->fournisseur->fromAddress(),
                $nomOrganisation,
                MailText::plain($this->messages->subject($campagne, $envoi)),
                $this->messages->body($campagne, $envoi),
                $this->jetons->url($envoi),
                $envoi->id,
                $this->messages->spaceLink($campagne),
                $envoi->user_id !== null ? $campagne->attachments->count() : 0,
                $envoi->user_id === null ? $this->piecesJointes($campagne, $pieces) : [],
            );
            $message = Mail::mailer($this->fournisseur->mailer())->to($envoi->email)->send($courrier);
        } catch (Throwable $erreur) {
            Log::warning('Envoi d\'une diffusion en échec', ['campaign' => $campagne->id, 'delivery' => $envoi->id, 'error' => $erreur::class]);
            $this->terminer($envoi, DeliveryStatus::Failed, 'transport');

            return;
        }

        $maintenant = now()->format('Y-m-d H:i:s.u');
        CampaignDelivery::query()->whereKey($envoi->id)->update([
            'status' => DeliveryStatus::Sent->value,
            'sent_at' => $maintenant,
            'updated_at' => $maintenant,
            'provider_message_id' => $message?->getMessageId(),
        ]);
    }

    private function terminer(CampaignDelivery $envoi, DeliveryStatus $statut, ?string $erreur = null): void
    {
        CampaignDelivery::query()->whereKey($envoi->id)->update(['status' => $statut->value, 'error_code' => $erreur, 'updated_at' => now()->format('Y-m-d H:i:s.u')]);
    }

    /**
     * @param  array<string, string>  $cache
     * @return list<array{name: string, contents: string}>
     */
    private function piecesJointes(Campaign $campagne, array &$cache): array
    {
        $fichiers = $this->documents->findMany(array_values($campagne->attachments->map(fn ($piece): string => $piece->stored_file_id)->all()));
        $pieces = [];

        foreach ($campagne->attachments as $piece) {
            if (! isset($fichiers[$piece->stored_file_id])) {
                continue;
            }

            $cache[$piece->stored_file_id] ??= $this->documents->contents($piece->stored_file_id);
            $pieces[] = ['name' => $fichiers[$piece->stored_file_id]->displayName, 'contents' => $cache[$piece->stored_file_id]];
        }

        return $pieces;
    }
}

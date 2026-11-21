<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Documents\Enums\ScanStatus;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Notifications\Data\AudienceMember;
use App\Modules\Notifications\Enums\CampaignStatus;
use App\Modules\Notifications\Enums\DeliveryStatus;
use App\Modules\Notifications\Enums\ErrorCode;
use App\Modules\Notifications\Models\Campaign;
use App\Modules\Notifications\Models\CampaignDelivery;
use App\Modules\Notifications\Queries\CampaignAudiences;
use App\Modules\Notifications\Queries\Suppressions;
use App\Modules\Notifications\Support\CampaignAccess;
use App\Modules\Notifications\Support\CampaignBatches;
use App\Modules\Notifications\Support\CampaignQuota;
use App\Modules\Notifications\Support\MailProvider;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Fige l'audience (une ligne par fiche, clé unique `(diffusion, fiche)`) puis lance les envois par paquets. Le passage à `sending`, le plafond
 * et la création des lignes se font dans la même transaction, sous le verrou de l'organisation : un rejeu ne crée rien, une course ne dépasse rien.
 */
final readonly class StartCampaign
{
    public function __construct(
        private MailProvider $fournisseur,
        private CampaignQuota $plafonds,
        private CampaignAudiences $audiences,
        private Suppressions $suppressions,
        private CurrentOrganization $organisation,
        private CampaignBatches $paquets,
        private RecordAudit $audit,
        private DocumentStore $documents,
        private CampaignAccess $acces,
    ) {}

    public function handle(string $campagneId, string $auteurId): Campaign
    {
        $this->fournisseur->assertEnabled();
        $this->acces->assertSenderStillAllowed($auteurId);

        $campagne = $this->plafonds->exclusive($this->organisation->id(), fn (): Campaign => DB::transaction(function () use ($campagneId, $auteurId): Campaign {
            $campagne = Campaign::query()->whereKey($campagneId)->lockForUpdate()->first() ?? throw ErrorCode::CampaignNotFound->problem();

            if (! in_array($campagne->status, [CampaignStatus::Draft, CampaignStatus::Scheduled], true)) {
                throw ErrorCode::CampaignNotEditable->problem();
            }

            $this->assertAttachmentsClean($campagne);

            $membres = $this->audiences->members($campagne->audience, $campagne->building_ids, CarbonImmutable::today());

            if ($membres === []) {
                throw ErrorCode::CampaignAudienceEmpty->problem();
            }

            $lignes = $this->lignes($campagne, $membres);
            $aEnvoyer = count(array_filter($lignes, fn (array $ligne): bool => $ligne['status'] === DeliveryStatus::Queued->value));
            $this->plafonds->assertAvailable($aEnvoyer);

            foreach (array_chunk($lignes, 200) as $paquet) {
                CampaignDelivery::query()->insert($paquet);
            }

            $campagne->forceFill([
                'status' => CampaignStatus::Sending,
                'sending_started_at' => now(),
                'sent_by_user_id' => $auteurId,
                'recipient_count' => count($lignes),
                'lock_version' => $campagne->lock_version + 1,
            ])->save();
            $this->audit->handle('notifications.campaign.sent', actorId: $auteurId, metadata: ['recipient_count' => count($lignes), 'queued' => $aEnvoyer], subject: $campagne);

            return $campagne;
        }));

        $this->paquets->dispatch($campagne);

        return $campagne;
    }

    private function assertAttachmentsClean(Campaign $campagne): void
    {
        $ids = $campagne->attachments()->pluck('stored_file_id')->all();
        $fichiers = $this->documents->findMany(array_values($ids));

        foreach ($ids as $id) {
            if (! isset($fichiers[$id]) || $fichiers[$id]->scanStatus !== ScanStatus::Clean) {
                throw ErrorCode::CampaignAttachmentNotReady->problem();
            }
        }
    }

    /**
     * @param  list<AudienceMember>  $membres
     * @return list<array<string, mixed>>
     */
    private function lignes(Campaign $campagne, array $membres): array
    {
        $empreintes = [];

        foreach ($membres as $membre) {
            $empreintes[$membre->partyId] = $this->valide($membre->email) ? $this->audit->fingerprint((string) $membre->email) : null;
        }

        $supprimees = $this->suppressions->among(array_values(array_filter($empreintes)));
        $dejaVues = [];
        $maintenant = now()->format('Y-m-d H:i:s.u');
        $lignes = [];

        foreach ($membres as $membre) {
            $empreinte = $empreintes[$membre->partyId];
            $erreur = null;

            if ($empreinte === null) {
                $statut = DeliveryStatus::SkippedNoEmail;
            } elseif (isset($supprimees[$empreinte])) {
                $statut = DeliveryStatus::Suppressed;
            } elseif (isset($dejaVues[$empreinte])) {
                $statut = DeliveryStatus::Suppressed;
                $erreur = 'duplicate_address';
            } else {
                $statut = DeliveryStatus::Queued;
                $dejaVues[$empreinte] = true;
            }

            $envoi = new CampaignDelivery;
            $envoi->forceFill([
                'id' => (string) Str::uuid7(),
                'organization_id' => $campagne->organization_id,
                'campaign_id' => $campagne->id,
                'party_id' => $membre->partyId,
                'user_id' => $membre->accountId,
                'lease_id' => $membre->leaseId,
                'email' => $empreinte === null ? null : trim((string) $membre->email),
                'email_hash' => $empreinte,
                'merge_values' => $membre->mergeValues,
                'status' => $statut,
                'error_code' => $erreur,
            ]);
            $lignes[] = [...$envoi->getAttributes(), 'created_at' => $maintenant, 'updated_at' => $maintenant];
        }

        return $lignes;
    }

    private function valide(?string $email): bool
    {
        return $email !== null && filter_var(trim($email), FILTER_VALIDATE_EMAIL) !== false;
    }
}

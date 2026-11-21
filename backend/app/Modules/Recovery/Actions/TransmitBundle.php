<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Actions;

use App\Modules\Catalog\Enums\ContactCategorySemantic;
use App\Modules\Parties\Data\PartyData;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Modules\Recovery\Enums\ActType;
use App\Modules\Recovery\Enums\ErrorCode;
use App\Modules\Recovery\Events\RecoveryBundleSent;
use App\Modules\Recovery\Models\RecoveryAct;
use App\Modules\Recovery\Models\RecoveryBundle;
use App\Modules\Recovery\Models\RecoveryCase;
use App\Modules\Recovery\Models\RecoveryTransmission;
use App\Modules\Recovery\Support\LinkTokens;
use App\Modules\Recovery\Support\TransmissionLink;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class TransmitBundle
{
    public function __construct(
        private PartyDirectory $parties,
        private TransmissionLink $liens,
        private CurrentOrganization $organisation,
        private RecordAudit $audit,
    ) {}

    /**
     * Crée le lien de téléchargement d'un envoi pour un commissaire de justice de l'organisation, avec l'acte `transmission`
     * du carnet, dans une seule transaction. L'e-mail part après le commit (`RecoveryBundleSent`) et ne contient que le lien.
     * `$replaces` : transmission remplacée par un renvoi, déjà révoquée par l'appelant.
     */
    public function handle(RecoveryBundle $bundle, string $recipientPartyId, ?int $validDays, CarbonImmutable $now, ?RecoveryTransmission $replaces = null): RecoveryTransmission
    {
        $this->liens->assertConfigured();
        $jours = min(max($validDays ?? (int) config('recovery.transmission.default_days'), 1), (int) config('recovery.transmission.max_days'));

        return DB::transaction(function () use ($bundle, $recipientPartyId, $jours, $now, $replaces): RecoveryTransmission {
            $dossier = RecoveryCase::query()->whereKey($bundle->case_id)->lockForUpdate()->firstOrFail();

            if (! $dossier->status->isActive()) {
                throw ErrorCode::CaseNotActive->problem();
            }

            $destinataire = $this->bailiff($recipientPartyId);
            $jeton = LinkTokens::generate();

            $transmission = RecoveryTransmission::query()->create([
                'bundle_id' => $bundle->id,
                'recipient_party_id' => $destinataire->id,
                'recipient_email' => (string) $destinataire->primaryEmail,
                'token_hash' => LinkTokens::hash($jeton),
                'expires_at' => $now->addDays($jours),
                'download_count' => 0,
                'replaces_id' => $replaces?->id,
                'created_by_user_id' => is_string(auth()->id()) ? auth()->id() : null,
            ]);

            RecoveryAct::query()->create([
                'case_id' => $dossier->id,
                'type' => ActType::Transmission,
                'performed_on' => $now->toDateString(),
                'author_user_id' => is_string(auth()->id()) ? auth()->id() : null,
                'reference' => $bundle->number,
                'data' => [
                    'bundle_id' => $bundle->id,
                    'transmission_id' => $transmission->id,
                    'recipient_party_id' => $destinataire->id,
                    'recipient_name' => $destinataire->displayName,
                    'pieces_count' => count($bundle->pieces),
                    'expires_at' => $transmission->expires_at->toIso8601String(),
                ],
            ]);

            $this->audit->handle('recovery.transmission.created', subject: $transmission, metadata: [
                'bundle' => $bundle->number,
                'recipient_party_id' => $destinataire->id,
                'expires_at' => $transmission->expires_at->toIso8601String(),
            ]);

            RecoveryBundleSent::dispatch($this->organisation->id(), $transmission->id, $jeton);

            return $transmission;
        });
    }

    private function bailiff(string $partyId): PartyData
    {
        foreach ($this->parties->withCategory(ContactCategorySemantic::Bailiff) as $partie) {
            if ($partie->id === $partyId && ! $partie->isAnonymized && $partie->primaryEmail !== null && $partie->primaryEmail !== '') {
                return $partie;
            }
        }

        throw ErrorCode::RecipientInvalid->problem();
    }
}

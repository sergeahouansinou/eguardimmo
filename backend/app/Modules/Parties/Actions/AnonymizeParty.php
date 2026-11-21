<?php

declare(strict_types=1);

namespace App\Modules\Parties\Actions;

use App\Modules\Identity\Enums\OwnerRevoker;
use App\Modules\Identity\Enums\TenantRevoker;
use App\Modules\Identity\PublicApi\TenantInvitations;
use App\Modules\Parties\Events\PartyAnonymized;
use App\Modules\Parties\Models\BankAccount;
use App\Modules\Parties\Models\ContactPoint;
use App\Modules\Parties\Models\ContactUpdateRequest;
use App\Modules\Parties\Models\Party;
use App\Modules\Parties\Models\PartyIdentifier;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class AnonymizeParty
{
    public const LIBELLE = 'Contact anonymisé';

    public function __construct(
        private RecordAudit $audit,
        private TenantInvitations $invitations,
        private RevokeOwnerAccessesOfParties $accesProprietaire,
    ) {}

    /**
     * Efface les données personnelles sans supprimer aucune ligne : les pièces émises gardent leur instantané (ADR 0022).
     * Sans effet sur une partie déjà anonymisée.
     *
     * @param  'account_deleted'|'requested'  $motif
     */
    public function handle(Party $party, string $motif): Party
    {
        return DB::transaction(function () use ($party, $motif): Party {
            $partie = Party::query()->whereKey($party->id)->lockForUpdate()->firstOrFail();

            if ($partie->isAnonymized()) {
                return $partie;
            }

            $partie->forceFill([
                'display_name' => self::LIBELLE,
                'last_name' => null,
                'first_name' => null,
                'company_name' => null,
                'birth_date' => null,
                'address' => null,
                'note' => null,
                'user_id' => null,
                'custom_fields' => [],
                'lock_version' => $partie->lock_version + 1,
                'anonymized_at' => now(),
            ])->save();

            foreach (ContactPoint::query()->where('party_id', $partie->id)->get() as $point) {
                $point->forceFill(['value' => null, 'label' => null, 'is_primary' => false, 'primary_slot' => null])->save();
            }

            foreach (PartyIdentifier::query()->where('party_id', $partie->id)->get() as $identifiant) {
                $identifiant->forceFill(['value' => null, 'value_hash' => null])->save();
            }

            foreach (BankAccount::query()->where('party_id', $partie->id)->get() as $compte) {
                $compte->forceFill([
                    'iban' => null, 'iban_last4' => null, 'iban_hash' => null, 'bic' => null, 'holder_name' => null,
                    'valid_to' => $compte->valid_to ?? $compte->valid_from->max(today()),
                ])->save();
            }

            ContactUpdateRequest::query()->where('party_id', $partie->id)->delete();
            $this->invitations->revokeForParty($partie->id, TenantRevoker::System, null);
            $this->accesProprietaire->handle([$partie->id], OwnerRevoker::System, null);
            $this->audit->handle('parties.party.anonymized', subject: $partie, metadata: ['reason' => $motif]);
            PartyAnonymized::dispatch($partie->id, $partie->organization_id);

            return $partie;
        });
    }
}

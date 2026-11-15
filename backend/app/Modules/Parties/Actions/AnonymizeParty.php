<?php

declare(strict_types=1);

namespace App\Modules\Parties\Actions;

use App\Modules\Parties\Models\BankAccount;
use App\Modules\Parties\Models\ContactPoint;
use App\Modules\Parties\Models\Party;
use App\Modules\Parties\Models\PartyIdentifier;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class AnonymizeParty
{
    public const LIBELLE = 'Contact anonymisé';

    public function __construct(private RecordAudit $audit) {}

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

            $this->audit->handle('parties.party.anonymized', subject: $partie, metadata: ['reason' => $motif]);

            return $partie;
        });
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Maintenance\Data\SupplierInputData;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\SupplierStatus;
use App\Modules\Maintenance\Models\SupplierProfile;
use App\Modules\Maintenance\Models\SupplierTrade;
use App\Modules\Parties\PublicApi\PartyDirectory;
use Illuminate\Support\Facades\DB;

final readonly class CreateSupplier
{
    public function __construct(
        private PartyDirectory $parties,
        private TermDirectory $termes,
    ) {}

    /**
     * Relation de travail avec une partie existante de l'organisation : nom, coordonnées et IBAN restent dans Parties.
     */
    public function handle(SupplierInputData $donnees): SupplierProfile
    {
        return DB::transaction(function () use ($donnees): SupplierProfile {
            $partie = $this->parties->find($donnees->partyId);

            if ($partie->isAnonymized) {
                throw ErrorCode::SupplierUnavailable->problem();
            }

            if (SupplierProfile::query()->where('party_id', $partie->id)->lockForUpdate()->exists()) {
                throw ErrorCode::SupplierStatusInvalid->problem('Ce prestataire existe déjà.');
            }

            $profil = SupplierProfile::query()->create([
                'party_id' => $partie->id,
                'status' => SupplierStatus::Active,
                'preferred' => $donnees->preferred,
                'payment_terms_days' => $donnees->paymentTermsDays,
                'internal_note' => $donnees->internalNote,
                'custom_fields' => $donnees->customFields,
                'lock_version' => 1,
            ]);
            $this->syncTrades($profil, $donnees->tradeTermIds);

            return $profil;
        });
    }

    /**
     * @param  list<string>  $termes
     */
    public function syncTrades(SupplierProfile $profil, array $termes): void
    {
        SupplierTrade::query()->where('supplier_profile_id', $profil->id)->delete();

        foreach (array_values(array_unique($termes)) as $terme) {
            SupplierTrade::query()->create([
                'supplier_profile_id' => $profil->id,
                'nature_term_id' => $this->termes->findAssignable($terme, VocabularyKey::InterventionNature)->id,
            ]);
        }
    }
}

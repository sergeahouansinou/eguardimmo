<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Actions;

use App\Modules\Organizations\Data\UpdateLegalIdentityData;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\Models\OrganizationLegalIdentity;
use App\Modules\Organizations\Support\OrganizationCurrency;
use App\Shared\Audit\RecordAudit;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Money\Money;

final readonly class UpdateLegalIdentity
{
    public function __construct(private RecordAudit $audit) {}

    /**
     * Crée ou remplace l'identité légale du siège ; la devise vient du pays de l'organisation, jamais du client.
     */
    public function handle(Organization $organisation, UpdateLegalIdentityData $donnees): OrganizationLegalIdentity
    {
        $devise = OrganizationCurrency::of($organisation->country);
        $valeurs = [
            'legal_name' => $donnees->legalName,
            'address' => $donnees->address,
            'siren' => $donnees->siren,
            'siret' => $donnees->siret,
            'vat_number' => $donnees->vatNumber,
            'legal_form' => $donnees->legalForm,
            'share_capital' => $donnees->shareCapital === null ? null : new Money($donnees->shareCapital, $devise),
            'currency' => $devise->getCode(),
            'registry_city' => $donnees->registryCity,
            'professional_card_number' => $donnees->professionalCardNumber,
            'professional_card_issuer' => $donnees->professionalCardIssuer,
            'guarantee_provider' => $donnees->guaranteeProvider,
            'guarantee_amount' => $donnees->guaranteeAmount === null ? null : new Money($donnees->guaranteeAmount, $devise),
            'vat_regime' => $donnees->vatRegime,
            'vat_on_debits' => $donnees->vatOnDebits,
            'payment_terms_days' => $donnees->paymentTermsDays,
        ];

        try {
            return DB::transaction(fn (): OrganizationLegalIdentity => $this->write($valeurs));
        } catch (UniqueConstraintViolationException) {
            return DB::transaction(fn (): OrganizationLegalIdentity => $this->write($valeurs));
        }
    }

    /**
     * Le journal ne garde que les noms des champs modifiés : les valeurs (SIREN, TVA, adresse) restent hors de `metadata`.
     *
     * @param  array<string, mixed>  $valeurs
     */
    private function write(array $valeurs): OrganizationLegalIdentity
    {
        $identite = OrganizationLegalIdentity::query()->lockForUpdate()->first() ?? new OrganizationLegalIdentity;
        $identite->fill($valeurs)->save();
        $champs = $identite->wasRecentlyCreated ? array_keys($valeurs) : array_values(array_diff(array_keys($identite->getChanges()), ['updated_at']));

        if ($champs !== []) {
            $this->audit->handle('organizations.legal_identity.updated', subject: $identite, metadata: ['created' => $identite->wasRecentlyCreated, 'fields' => $champs]);
        }

        return $identite;
    }
}

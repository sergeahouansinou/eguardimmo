<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Queries;

use App\Modules\Organizations\Data\LegalIdentityData;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\Models\OrganizationLegalIdentity;
use App\Shared\Tenancy\CurrentOrganization;

final readonly class LegalIdentities
{
    public function __construct(private CurrentOrganization $contexte) {}

    public function current(): ?OrganizationLegalIdentity
    {
        return OrganizationLegalIdentity::query()->first();
    }

    public function country(): string
    {
        return (string) Organization::query()->whereKey($this->contexte->id())->value('country');
    }

    public function timezone(): string
    {
        return (string) Organization::query()->whereKey($this->contexte->id())->value('timezone');
    }

    public function data(): ?LegalIdentityData
    {
        $identite = $this->current();

        if ($identite === null) {
            return null;
        }

        $pays = $this->country();

        return new LegalIdentityData(
            organizationId: $identite->organization_id,
            country: $pays,
            legalName: $identite->legal_name,
            address: $identite->address,
            siren: $identite->siren,
            siret: $identite->siret,
            vatNumber: $identite->vat_number,
            legalForm: $identite->legal_form,
            shareCapital: $identite->share_capital === null ? null : (int) $identite->share_capital->getAmount(),
            currency: $identite->currency,
            registryCity: $identite->registry_city,
            professionalCardNumber: $identite->professional_card_number,
            professionalCardIssuer: $identite->professional_card_issuer,
            guaranteeProvider: $identite->guarantee_provider,
            guaranteeAmount: $identite->guarantee_amount === null ? null : (int) $identite->guarantee_amount->getAmount(),
            vatRegime: $identite->vat_regime,
            vatOnDebits: $identite->vat_on_debits,
            paymentTermsDays: $identite->payment_terms_days,
        );
    }
}

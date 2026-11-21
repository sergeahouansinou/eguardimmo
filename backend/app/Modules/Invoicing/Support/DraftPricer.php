<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Support;

use App\Modules\Invoicing\Data\DraftData;
use App\Modules\Invoicing\Jurisdictions\InvoiceRules;
use App\Modules\Organizations\Enums\VatRegime;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use Carbon\CarbonImmutable;

/**
 * Le serveur chiffre tout : juridiction du siège, devise, régime de TVA, taux de la date, nets et taxes. Le client ne
 * fournit que le destinataire, les références, les quantités et les prix.
 */
final readonly class DraftPricer
{
    public function __construct(
        private OrganizationDirectory $organisations,
        private InvoiceRules $juridictions,
        private References $references,
        private DraftLines $lignes,
        private Calculator $calcul,
    ) {}

    public function price(DraftData $donnees, CarbonImmutable $jour): PricedDraft
    {
        $juridiction = $this->organisations->country();
        $regles = $this->juridictions->for($juridiction);
        $identite = $this->organisations->legalIdentity();
        $regime = $identite === null ? VatRegime::Normal : $identite->vatRegime;
        $refs = $this->references->check($donnees->recipientPartyId, $donnees->leaseId, $donnees->mandateId);
        $chiffree = $this->calcul->price($this->lignes->build($donnees->lines, $regles, $refs, $donnees->feeStatementId !== null), $regles, $regime, $jour, $regles->currency(), $refs->recipientIsVatRegisteredCompany);

        return new PricedDraft($regles, $refs, $chiffree, $juridiction, $regime, $identite !== null && $identite->vatOnDebits);
    }
}

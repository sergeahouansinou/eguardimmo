<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Support;

use App\Modules\Invoicing\Enums\ErrorCode;
use App\Modules\Organizations\Data\LegalIdentityData;
use App\Modules\Organizations\Enums\VatRegime;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Parties\Data\PartyInvoiceData;
use App\Modules\Parties\Enums\PartyKind;
use App\Modules\Parties\PublicApi\PartyDirectory;

/**
 * Mentions obligatoires : un émetteur ou un destinataire incomplet n'obtient jamais de pièce numérotée.
 */
final readonly class IssueChecks
{
    public function __construct(
        private OrganizationDirectory $organisations,
        private PartyDirectory $parties,
    ) {}

    public function issuer(): LegalIdentityData
    {
        $identite = $this->organisations->legalIdentity() ?? throw ErrorCode::IssuerIncomplete->problem();

        if (trim($identite->legalName) === '' || $identite->siren === '' || $identite->address['line1'] === ''
            || ($identite->vatRegime === VatRegime::Normal && ($identite->vatNumber === null || $identite->vatNumber === ''))) {
            throw ErrorCode::IssuerIncomplete->problem();
        }

        return $identite;
    }

    public function recipient(string $partyId): PartyInvoiceData
    {
        $destinataire = $this->parties->invoiceIdentity($partyId);

        if ($destinataire->isAnonymized) {
            throw ErrorCode::RecipientIncomplete->problem();
        }

        if ($destinataire->kind === PartyKind::Company && ($destinataire->address === null || $destinataire->siren === null)) {
            throw ErrorCode::RecipientIncomplete->problem();
        }

        return $destinataire;
    }
}

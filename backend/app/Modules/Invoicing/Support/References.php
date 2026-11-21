<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Support;

use App\Modules\Invoicing\Enums\ErrorCode;
use App\Modules\Leases\Data\LeasePartyData;
use App\Modules\Leases\Data\LeaseUnitData;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Leases\PublicApi\LeaseParticipants;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Parties\Enums\PartyKind;
use App\Modules\Parties\PublicApi\PartyDirectory;

/**
 * Partie, bail et mandat d'une facture, vérifiés par leur PublicApi dans l'organisation courante : une référence
 * d'une autre organisation lève 404 (IDOR).
 */
final readonly class References
{
    public function __construct(
        private PartyDirectory $parties,
        private LeaseDirectory $baux,
        private LeaseParticipants $participants,
        private MandateDirectory $mandats,
    ) {}

    public function check(string $recipientPartyId, ?string $leaseId, ?string $mandateId): ReferenceContext
    {
        $destinataire = $this->parties->invoiceIdentity($recipientPartyId);

        $bail = $leaseId === null ? null : $this->baux->find($leaseId);
        $mandat = $mandateId === null ? null : $this->mandats->find($mandateId);
        $surLeBail = $leaseId !== null && array_any(
            $this->participants->partiesOf($leaseId),
            fn (LeasePartyData $ligne): bool => $ligne->partyId === $recipientPartyId,
        );

        $estMandant = $mandat !== null && $mandat->mandantPartyId === $recipientPartyId;

        if ($bail !== null && ! $surLeBail && ! $estMandant) {
            throw ErrorCode::ReferencesInconsistent->problem();
        }

        if ($mandat !== null && $bail === null && ! $estMandant) {
            throw ErrorCode::ReferencesInconsistent->problem();
        }

        if ($mandat !== null && $bail !== null && array_intersect(array_map(fn (LeaseUnitData $lot): string => $lot->unitId, $bail->units), $mandat->unitIds) === []) {
            throw ErrorCode::ReferencesInconsistent->problem();
        }

        return new ReferenceContext(
            recipientIsMandant: $estMandant,
            recipientOnLease: $surLeBail,
            recipientIsVatRegisteredCompany: $destinataire->kind === PartyKind::Company && $destinataire->vatNumber !== null && $destinataire->vatNumber !== '',
            leaseReference: $bail?->reference,
            mandateReference: $mandat?->reference,
        );
    }
}

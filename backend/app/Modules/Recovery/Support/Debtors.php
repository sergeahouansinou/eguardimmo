<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Support;

use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\PublicApi\LeaseParticipants;
use App\Modules\Recovery\Data\Receivable;
use App\Modules\Recovery\Enums\ErrorCode;

final readonly class Debtors
{
    public function __construct(private LeaseParticipants $participants) {}

    /**
     * Le débiteur est une partie qui a été locataire du bail, aujourd'hui ou avant (un ancien locataire reste redevable).
     */
    public function assertTenantOf(string $leaseId, string $partyId): void
    {
        foreach ($this->participants->partiesOf($leaseId) as $ligne) {
            if ($ligne->partyId === $partyId && $ligne->role === LeasePartyRole::Tenant) {
                return;
            }
        }

        throw ErrorCode::DebtorInvalid->problem();
    }

    /**
     * Chaque créance est portée par un locataire du bail (cotitulaires solidaires compris) ; le débiteur choisi l'est aussi.
     *
     * @param  list<Receivable>  $creances
     */
    public function assertReceivablesOf(string $leaseId, string $debtorPartyId, array $creances): void
    {
        $locataires = [];

        foreach ($this->participants->partiesOf($leaseId) as $ligne) {
            if ($ligne->role === LeasePartyRole::Tenant) {
                $locataires[$ligne->partyId] = true;
            }
        }

        if (! isset($locataires[$debtorPartyId])) {
            throw ErrorCode::DebtorInvalid->problem();
        }

        foreach ($creances as $creance) {
            if ($creance->partyId === null || ! isset($locataires[$creance->partyId])) {
                throw ErrorCode::ReceivableInvalid->problem();
            }
        }
    }
}

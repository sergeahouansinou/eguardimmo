<?php

declare(strict_types=1);

namespace App\Modules\Parties\Support;

use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Parties\Enums\ErrorCode;
use App\Modules\Parties\Models\Party;
use App\Modules\Parties\Notifications\BankAccountChangedAlertNotification;
use App\Modules\Parties\Queries\OwnerAccesses;
use App\Modules\Parties\Queries\PartySummaries;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\Notification;

/**
 * Changement de coordonnées bancaires par l'agence (ADR 0032, décision 5) : refusé tant que le mandant a un accès vivant, car
 * son compte de paiement ne change que par sa demande ; sinon l'adresse principale de la fiche est alertée.
 */
final readonly class AgencyBankAccountChange
{
    public function __construct(
        private OwnerAccesses $acces,
        private OrganizationDirectory $organisations,
        private PartySummaries $resumes,
        private CurrentOrganization $contexte,
    ) {}

    public function assertAllowed(Party $partie): void
    {
        if ($this->acces->countActiveOfMandant($partie->id) > 0) {
            throw ErrorCode::OwnerAccessRequiresPayoutRequest->problem();
        }
    }

    public function alert(Party $partie): void
    {
        $principale = $this->resumes->one($partie->id)->primaryEmail;

        if ($principale === null) {
            return;
        }

        $nom = $this->organisations->names([$this->contexte->id()])[$this->contexte->id()] ?? '';
        Notification::route('mail', $principale)->notify(new BankAccountChangedAlertNotification($nom));
    }
}

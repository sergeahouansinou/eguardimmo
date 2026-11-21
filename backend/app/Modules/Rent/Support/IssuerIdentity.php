<?php

declare(strict_types=1);

namespace App\Modules\Rent\Support;

use App\Modules\Organizations\PublicApi\MembershipDirectory;
use App\Modules\Rent\Enums\ErrorCode;
use App\Shared\Tenancy\CurrentOrganization;

/**
 * Émetteur des pièces : l'organisation de la requête, lue par l'adhésion du compte connecté. Une tâche planifiée n'a
 * pas de compte et n'émet donc aucune pièce.
 */
final class IssuerIdentity
{
    /** @var array<string, string> */
    private array $names = [];

    public function __construct(
        private readonly MembershipDirectory $adhesions,
        private readonly CurrentOrganization $organisation,
    ) {}

    public function name(): string
    {
        $compte = auth()->id();

        if (! is_string($compte)) {
            throw ErrorCode::IssuerUnknown->problem();
        }

        $cle = $compte.'|'.$this->organisation->id();

        if (! isset($this->names[$cle])) {
            $adhesion = $this->adhesions->activeMembership($compte, $this->organisation->id()) ?? throw ErrorCode::IssuerUnknown->problem();
            $this->names[$cle] = $adhesion->organizationName;
        }

        return $this->names[$cle];
    }

    public function organizationId(): string
    {
        return $this->organisation->id();
    }
}

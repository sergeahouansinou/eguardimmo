<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Support;

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Mandates\Data\OwnerScopeData;
use App\Modules\Mandates\Enums\ErrorCode as MandatesErrorCode;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Reporting\Enums\ErrorCode;

/**
 * Le couple (agence, mandant) unique qu'une lecture à un seul mandant (accueil, relevé) sert. La clé reste celle du compte connecté :
 * `agency` restreint seulement, et un compte qui a plusieurs couples doit le préciser au lieu qu'on en choisisse un à sa place.
 */
final readonly class OwnerSelection
{
    public function __construct(private MandateDirectory $mandats) {}

    /**
     * @param  bool  $sansCoIndivisaire  vrai pour une donnée du compte du mandant : le co-indivisaire n'y accède pas (ADR 0032)
     */
    public function one(string $userId, ?string $agency, bool $sansCoIndivisaire = false): OwnerScopeData
    {
        $portee = $this->mandats->ownerScope($userId, $agency);

        if ($portee->visibles === []) {
            throw ErrorCode::OwnerMandantNotFound->problem();
        }

        if (count($portee->visibles) > 1) {
            throw ErrorCode::OwnerAgencyRequired->problem();
        }

        if ($sansCoIndivisaire && $portee->visibles[0]->role === OwnerAccessRole::CoOwner) {
            throw MandatesErrorCode::OwnerRoleForbidden->problem();
        }

        return $portee;
    }
}

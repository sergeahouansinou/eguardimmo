<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Support;

use App\Modules\OwnerFunds\Enums\ErrorCode;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Shared\Http\ApiProblem;

final readonly class Mandants
{
    public function __construct(private PartyDirectory $parties) {}

    /**
     * 404 `owner_funds_mandant_not_found` pour une partie inconnue ou d'une autre organisation.
     */
    public function assertExists(string $partyId): void
    {
        try {
            $this->parties->find($partyId);
        } catch (ApiProblem $erreur) {
            throw $erreur->status === 404 ? ErrorCode::MandantNotFound->problem() : $erreur;
        }
    }
}

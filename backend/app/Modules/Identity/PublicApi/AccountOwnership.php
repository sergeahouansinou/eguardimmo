<?php

declare(strict_types=1);

namespace App\Modules\Identity\PublicApi;

use App\Modules\Identity\Actions\ConfirmAccountOwnership;
use App\Modules\Identity\Queries\AccountFiles;
use App\Modules\Identity\Support\ReauthenticationProof;
use Illuminate\Http\Request;

/**
 * Preuve que la personne derrière la requête détient le compte (même contrôle que la suppression du compte) : lève
 * `reauthentication_required` sinon.
 */
final readonly class AccountOwnership
{
    public function __construct(private ConfirmAccountOwnership $confirmation, private AccountFiles $comptes) {}

    public function confirm(string $userId, Request $requete): void
    {
        $compte = $this->comptes->find($userId);

        $this->confirmation->handle($compte, ReauthenticationProof::fromRequest($requete));
    }
}

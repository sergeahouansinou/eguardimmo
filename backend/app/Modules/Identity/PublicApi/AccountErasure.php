<?php

declare(strict_types=1);

namespace App\Modules\Identity\PublicApi;

use App\Modules\Identity\Actions\DeleteAccount;
use App\Modules\Identity\Queries\AccountFiles;
use App\Modules\Identity\Support\ConsoleAccountGuard;

/**
 * Effacement d'un compte à la demande de la personne : le flux de suppression existant, jamais pour un opérateur ni un compte déjà supprimé.
 */
final readonly class AccountErasure
{
    public function __construct(private DeleteAccount $suppression, private AccountFiles $comptes) {}

    public function assertErasable(string $userId): void
    {
        ConsoleAccountGuard::assertActionable($this->comptes->find($userId));
    }

    public function erase(string $userId): void
    {
        $compte = $this->comptes->find($userId);

        ConsoleAccountGuard::assertActionable($compte);
        $this->suppression->handle($compte);
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers\Console;

use App\Modules\Identity\Actions\SuspendAccount;
use App\Modules\Identity\Http\Requests\SuspendAccountRequest;
use App\Modules\Identity\Http\Resources\Console\AccountResource;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Queries\AccountFiles;

final class SuspendAccountController
{
    public function __invoke(SuspendAccountRequest $requete, string $user, AccountFiles $fiches, SuspendAccount $action): AccountResource
    {
        /** @var User $operateur */
        $operateur = $requete->user();

        $compte = $action->handle($fiches->find($user), $requete->reason(), $operateur);

        return new AccountResource($fiches->file($compte));
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers\Console;

use App\Modules\Identity\Actions\RevokeAccountSessions;
use App\Modules\Identity\Http\Resources\Console\AccountResource;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Queries\AccountFiles;
use Illuminate\Http\Request;

final class RevokeAccountSessionsController
{
    public function __invoke(Request $requete, string $user, AccountFiles $fiches, RevokeAccountSessions $action): AccountResource
    {
        /** @var User $operateur */
        $operateur = $requete->user();
        $compte = $fiches->find($user);

        $action->handle($compte, $operateur);

        return new AccountResource($fiches->file($compte));
    }
}

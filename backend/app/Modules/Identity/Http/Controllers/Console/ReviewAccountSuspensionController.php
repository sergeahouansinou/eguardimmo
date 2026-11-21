<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers\Console;

use App\Modules\Identity\Actions\ReviewAccountSuspension;
use App\Modules\Identity\Http\Resources\Console\AccountResource;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Queries\AccountFiles;
use Illuminate\Http\Request;

final class ReviewAccountSuspensionController
{
    public function __invoke(Request $requete, string $user, AccountFiles $fiches, ReviewAccountSuspension $action): AccountResource
    {
        /** @var User $operateur */
        $operateur = $requete->user();

        $compte = $action->handle($fiches->find($user), $operateur);

        return new AccountResource($fiches->file($compte));
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers\Console;

use App\Modules\Identity\Http\Resources\Console\AccountResource;
use App\Modules\Identity\Queries\AccountFiles;
use App\Shared\Audit\RecordAudit;

final class ShowAccountController
{
    public function __invoke(string $user, AccountFiles $fiches, RecordAudit $audit): AccountResource
    {
        $compte = $fiches->find($user);

        $audit->handle('console.account.viewed', metadata: [], subject: $compte);

        return new AccountResource($fiches->file($compte));
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Console;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Actions\GrantSupportAccess;
use App\Modules\Messaging\Http\Requests\GrantAccessRequest;
use App\Modules\Messaging\Http\Resources\TicketDetailResource;
use App\Modules\Messaging\Support\TicketLoader;

final class GrantAccessController
{
    public function __invoke(GrantAccessRequest $request, string $ticket, GrantSupportAccess $accorder): TicketDetailResource
    {
        /** @var User $operateur */
        $operateur = $request->user();
        $accorder->handle(TicketLoader::forSupport($ticket), $operateur, trim((string) $request->string('reason')));

        return new TicketDetailResource(TicketLoader::forSupport($ticket), vueSupport: true);
    }
}

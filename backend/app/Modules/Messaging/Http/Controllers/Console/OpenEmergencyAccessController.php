<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Console;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Actions\OpenEmergencyAccess;
use App\Modules\Messaging\Http\Requests\EmergencyAccessRequest;
use App\Modules\Messaging\Http\Resources\Console\SupportAccessGrantResource;
use App\Modules\Messaging\Support\TicketLoader;
use Illuminate\Http\JsonResponse;

final class OpenEmergencyAccessController
{
    public function __invoke(EmergencyAccessRequest $request, string $ticket, OpenEmergencyAccess $urgence): JsonResponse
    {
        /** @var User $operateur */
        $operateur = $request->user();
        $acces = $urgence->handle($operateur, TicketLoader::lightForSupport($ticket), $request->basis(), $request->reason());

        return (new SupportAccessGrantResource($acces->load('operator')))->response()->setStatusCode(201);
    }
}

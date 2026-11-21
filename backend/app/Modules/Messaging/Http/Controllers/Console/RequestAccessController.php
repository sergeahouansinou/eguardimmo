<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Console;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Actions\RequestSupportAccess;
use App\Modules\Messaging\Http\Requests\RequestSupportAccessRequest;
use App\Modules\Messaging\Http\Resources\Console\SupportAccessGrantResource;
use App\Modules\Messaging\Support\TicketLoader;
use Illuminate\Http\JsonResponse;

final class RequestAccessController
{
    public function __invoke(RequestSupportAccessRequest $request, string $ticket, RequestSupportAccess $demander): JsonResponse
    {
        /** @var User $operateur */
        $operateur = $request->user();
        $acces = $demander->handle($operateur, TicketLoader::lightForSupport($ticket), $request->scopes(), $request->reason(), $request->hours());

        return (new SupportAccessGrantResource($acces->load('operator')))->response()->setStatusCode(201);
    }
}

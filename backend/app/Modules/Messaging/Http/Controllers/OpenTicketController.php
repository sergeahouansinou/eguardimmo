<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Actions\OpenSupportTicket;
use App\Modules\Messaging\Http\Requests\OpenTicketRequest;
use App\Modules\Messaging\Http\Resources\TicketDetailResource;
use App\Modules\Messaging\Support\TicketLoader;
use Illuminate\Http\JsonResponse;

final class OpenTicketController
{
    public function __invoke(OpenTicketRequest $request, OpenSupportTicket $ouvrir): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $ouverte = $ouvrir->handle($user, $request->toData());

        return (new TicketDetailResource(TicketLoader::forRequester($request, $ouverte->ticket->id), vueSupport: false))->response()->setStatusCode($ouverte->replayed ? 200 : 201);
    }
}

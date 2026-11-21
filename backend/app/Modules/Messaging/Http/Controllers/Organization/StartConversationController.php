<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Actions\StartConversation;
use App\Modules\Messaging\Http\Requests\StartConversationRequest;
use App\Modules\Messaging\Http\Resources\ConversationDetailResource;
use App\Modules\Messaging\Support\ConversationLoader;
use App\Modules\Messaging\Support\StaffAccess;
use App\Modules\Messaging\Support\StaffDesk;
use Illuminate\Http\JsonResponse;

final class StartConversationController
{
    public function __invoke(StartConversationRequest $request, StartConversation $demarrer, StaffDesk $bureau, StaffAccess $acces): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $kind = $request->kind();

        if ($kind->isExternal()) {
            $acces->assertExternal($user, $kind);
            $ouvert = $bureau->open($user, $request->toExternalData());

            return $bureau->show($bureau->fresh($user, $ouvert->conversation->id), $user, 1)->response()->setStatusCode($ouvert->replayed ? 200 : 201);
        }

        $conversation = $demarrer->handle($user, $request->toData());

        return (new ConversationDetailResource(ConversationLoader::participation($request, $conversation->id)))->response()->setStatusCode(201);
    }
}

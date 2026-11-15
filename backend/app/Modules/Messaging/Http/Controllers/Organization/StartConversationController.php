<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Actions\StartConversation;
use App\Modules\Messaging\Http\Requests\StartConversationRequest;
use App\Modules\Messaging\Http\Resources\ConversationDetailResource;
use App\Modules\Messaging\Support\ConversationLoader;
use Illuminate\Http\JsonResponse;

final class StartConversationController
{
    public function __invoke(StartConversationRequest $request, StartConversation $demarrer): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $conversation = $demarrer->handle($user, $request->toData());

        return (new ConversationDetailResource(ConversationLoader::participation($request, $conversation->id)))->response()->setStatusCode(201);
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Actions\PostConversationMessage;
use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Messaging\Http\Requests\ReplyRequest;
use App\Modules\Messaging\Http\Resources\ConversationDetailResource;
use App\Modules\Messaging\Queries\StaffThreads;
use App\Modules\Messaging\Support\ConversationLoader;
use App\Modules\Messaging\Support\MessageInput;
use App\Modules\Messaging\Support\StaffAccess;
use App\Modules\Messaging\Support\StaffDesk;
use Illuminate\Http\JsonResponse;

final class ReplyConversationController
{
    public function __invoke(ReplyRequest $request, string $conversation, PostConversationMessage $poster, StaffThreads $fils, StaffDesk $bureau, StaffAccess $acces): ConversationDetailResource|JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $externe = $fils->find($user->id, $conversation);

        if ($externe !== null) {
            $acces->assertExternal($user, $externe->kind);
            $envoye = $bureau->post($externe, $user, MessageInput::body($request), MessageInput::attachments($request), MessageInput::clientId($request));

            return $bureau->messageResource($envoye->message, $user)->response()->setStatusCode($envoye->replayed ? 200 : 201);
        }

        $poster->handle(ConversationLoader::conversation($request, $conversation), $user, MessageSide::Staff, MessageInput::body($request), MessageInput::attachments($request), MessageInput::clientId($request));

        return new ConversationDetailResource(ConversationLoader::participation($request, $conversation));
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Actions\PostConversationMessage;
use App\Modules\Messaging\Http\Requests\ReplyRequest;
use App\Modules\Messaging\Http\Resources\ConversationDetailResource;
use App\Modules\Messaging\Support\ConversationLoader;
use App\Modules\Messaging\Support\MessageInput;

final class ReplyConversationController
{
    public function __invoke(ReplyRequest $request, string $conversation, PostConversationMessage $poster): ConversationDetailResource
    {
        /** @var User $user */
        $user = $request->user();
        $poster->handle(ConversationLoader::participation($request, $conversation)->conversation, $user, MessageInput::body($request), MessageInput::attachments($request));

        return new ConversationDetailResource(ConversationLoader::participation($request, $conversation));
    }
}

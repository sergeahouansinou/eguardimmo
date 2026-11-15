<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Organization;

use App\Modules\Messaging\Actions\SetConversationState;
use App\Modules\Messaging\Http\Requests\ConversationStateRequest;
use App\Modules\Messaging\Http\Resources\ConversationSummaryResource;
use App\Modules\Messaging\Support\ConversationLoader;

final class UpdateConversationStateController
{
    public function __invoke(ConversationStateRequest $request, string $conversation, SetConversationState $etat): ConversationSummaryResource
    {
        return new ConversationSummaryResource($etat->handle(ConversationLoader::participation($request, $conversation), $request->read(), $request->archived()));
    }
}

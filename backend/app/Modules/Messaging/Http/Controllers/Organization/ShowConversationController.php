<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Organization;

use App\Modules\Messaging\Actions\SetConversationState;
use App\Modules\Messaging\Http\Resources\ConversationDetailResource;
use App\Modules\Messaging\Support\ConversationLoader;
use Illuminate\Http\Request;

final class ShowConversationController
{
    public function __invoke(Request $request, string $conversation, SetConversationState $etat): ConversationDetailResource
    {
        $participation = ConversationLoader::participation($request, $conversation);
        $etat->handle($participation, lu: true, archive: null);

        return new ConversationDetailResource($participation);
    }
}

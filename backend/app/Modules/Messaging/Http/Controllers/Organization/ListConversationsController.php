<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Organization;

use App\Modules\Messaging\Http\Requests\ListConversationsRequest;
use App\Modules\Messaging\Http\Resources\ConversationSummaryResource;
use App\Modules\Messaging\Queries\Inbox;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListConversationsController
{
    public function __invoke(ListConversationsRequest $request, Inbox $boite): AnonymousResourceCollection
    {
        $vis = (string) $request->user()?->getAuthIdentifier();
        $filtres = $request->toData();

        return ConversationSummaryResource::collection($boite->list($vis, $filtres))
            ->additional(['viewer_id' => $vis, 'counts' => $boite->counts($vis, $filtres->search)]);
    }
}

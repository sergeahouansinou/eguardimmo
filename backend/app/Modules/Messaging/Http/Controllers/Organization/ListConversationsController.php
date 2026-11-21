<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Http\Requests\ListConversationsRequest;
use App\Modules\Messaging\Http\Resources\ConversationSummaryResource;
use App\Modules\Messaging\Queries\Inbox;
use App\Modules\Messaging\Support\StaffAccess;
use App\Modules\Messaging\Support\StaffDesk;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListConversationsController
{
    public function __invoke(ListConversationsRequest $request, Inbox $boite, StaffDesk $bureau, StaffAccess $acces): AnonymousResourceCollection
    {
        /** @var User $user */
        $user = $request->user();
        $kind = $request->kind();

        if ($kind->isExternal()) {
            $acces->assertExternal($user, $kind);

            return $bureau->list($user, $kind, $request->toExternalData());
        }

        $filtres = $request->toData();

        return ConversationSummaryResource::collection($boite->list($user->id, $filtres))
            ->additional(['viewer_id' => $user->id, 'counts' => $boite->counts($user->id, $filtres->search)]);
    }
}
